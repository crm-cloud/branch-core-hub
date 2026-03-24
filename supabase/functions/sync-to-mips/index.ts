import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cachedToken: string | null = null;
let tokenExpiry = 0;

// Chunked base64 encoder to avoid stack overflow on large buffers
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function getHostUrl(): string {
  const MIPS_URL = Deno.env.get("MIPS_SERVER_URL")!.replace(/\/+$/, "");
  const urlObj = new URL(MIPS_URL);
  return `${urlObj.protocol}//${urlObj.host}`;
}

async function getMIPSToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const MIPS_USER = Deno.env.get("MIPS_USERNAME")!;
  const MIPS_PASS = Deno.env.get("MIPS_PASSWORD")!;
  const hostUrl = getHostUrl();

  const res = await fetch(`${hostUrl}/apiExternal/generateToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ identity: MIPS_USER, pStr: MIPS_PASS }),
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("MIPS auth returned non-JSON:", text.substring(0, 500));
    throw new Error("MIPS auth endpoint returned non-JSON response");
  }

  const codeVal = Number(json.code);
  if (codeVal !== 200 && codeVal !== 0) {
    throw new Error(`MIPS auth error: ${json.msg || JSON.stringify(json)}`);
  }

  cachedToken = json.data || json.token || json.result;
  if (!cachedToken) throw new Error("No token in MIPS auth response");
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return cachedToken!;
}

// Try multiple MIPS save endpoints with JSON content type
async function savePerson(token: string, personData: Record<string, unknown>): Promise<{ success: boolean; json: any; endpoint: string }> {
  const hostUrl = getHostUrl();
  
  // MIPS Spring Boot endpoints to try — the correct one depends on the MIPS version
  const endpoints = [
    "/admin/person/employees/save",
    "/apiExternal/person/save",
    "/apiExternal/employee/save",
  ];

  for (const endpoint of endpoints) {
    const url = `${hostUrl}${endpoint}`;
    console.log(`Trying MIPS save: POST ${url}`);
    
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "owl-auth-token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(personData),
      });

      const responseText = await res.text();
      
      // Check if we got HTML (404 page) — try next endpoint
      if (responseText.trimStart().startsWith("<!") || responseText.trimStart().startsWith("<html")) {
        console.warn(`Endpoint ${endpoint} returned HTML (status ${res.status}), trying next...`);
        continue;
      }

      try {
        const json = JSON.parse(responseText);
        console.log(`Endpoint ${endpoint} responded with JSON:`, JSON.stringify(json));
        const code = Number(json.code);
        return { 
          success: code === 200 || code === 0 || res.ok, 
          json, 
          endpoint 
        };
      } catch {
        console.warn(`Endpoint ${endpoint} returned non-JSON non-HTML:`, responseText.substring(0, 200));
        continue;
      }
    } catch (fetchErr) {
      console.warn(`Endpoint ${endpoint} fetch error:`, fetchErr);
      continue;
    }
  }

  // If all JSON endpoints fail, try form-urlencoded on the first endpoint as last resort
  const lastResortUrl = `${hostUrl}/admin/person/employees/save`;
  console.log(`All JSON endpoints failed. Trying form-urlencoded: POST ${lastResortUrl}`);
  
  const formData = new URLSearchParams();
  for (const [k, v] of Object.entries(personData)) {
    if (k === "imgBase64") {
      formData.set("imgBase64", String(v));
    } else {
      formData.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
  }

  const res = await fetch(lastResortUrl, {
    method: "POST",
    headers: {
      "owl-auth-token": token,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const responseText = await res.text();
  
  if (responseText.trimStart().startsWith("<!") || responseText.trimStart().startsWith("<html")) {
    throw new Error(`All MIPS save endpoints returned 404/HTML. Tried: ${endpoints.join(", ")} (JSON) and ${lastResortUrl} (form). The MIPS server may need a different API path configuration.`);
  }

  try {
    const json = JSON.parse(responseText);
    const code = Number(json.code);
    return { success: code === 200 || code === 0, json, endpoint: lastResortUrl + " (form)" };
  } catch {
    throw new Error(`MIPS save returned unparseable response: ${responseText.substring(0, 300)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const { person_type, person_id, branch_id } = body as {
      person_type: "member" | "employee";
      person_id: string;
      branch_id?: string;
    };

    if (!person_id || !person_type) {
      return new Response(JSON.stringify({ error: "Missing person_id or person_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getMIPSToken();
    console.log("MIPS token acquired successfully");

    let personData: Record<string, unknown>;
    let photoUrl: string | null = null;
    let tableName: string;
    let personNo: string;
    let name: string;
    let expireTime: string | null = null;

    if (person_type === "member") {
      tableName = "members";
      const { data: member, error } = await supabase
        .from("members")
        .select("*, profiles:user_id(full_name, phone, avatar_url, email)")
        .eq("id", person_id)
        .single();

      if (error || !member) throw new Error(`Member not found: ${error?.message}`);

      const profile = member.profiles as any;
      name = profile?.full_name || "Unknown";
      personNo = member.member_code || person_id.substring(0, 8);
      photoUrl = member.biometric_photo_url || profile?.avatar_url;

      const { data: membership } = await supabase
        .from("memberships")
        .select("end_date")
        .eq("member_id", person_id)
        .eq("status", "active")
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (membership?.end_date) {
        expireTime = membership.end_date + " 23:59:59";
      }

      personData = {
        name,
        personNo,
        phone: profile?.phone || "",
        department: "Member",
        expireTime: expireTime || "2030-12-31 23:59:59",
      };
    } else {
      tableName = "employees";
      const { data: emp, error } = await supabase
        .from("employees")
        .select("*, profiles:user_id(full_name, phone, avatar_url, email)")
        .eq("id", person_id)
        .single();

      if (error || !emp) throw new Error(`Employee not found: ${error?.message}`);

      const profile = emp.profiles as any;
      name = profile?.full_name || "Unknown";
      personNo = emp.employee_code || person_id.substring(0, 8);
      photoUrl = emp.biometric_photo_url || profile?.avatar_url;

      personData = {
        name,
        personNo,
        phone: profile?.phone || "",
        department: "Staff",
        expireTime: "2030-12-31 23:59:59",
      };
    }

    // Download and convert photo to base64
    if (photoUrl) {
      try {
        let imageUrl = photoUrl;
        if (photoUrl.startsWith("member-photos/") || photoUrl.startsWith("avatars/")) {
          const bucketName = photoUrl.startsWith("member-photos/") ? "member-photos" : "avatars";
          const { data: urlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(photoUrl.replace(/^(member-photos|avatars)\//, ""));
          imageUrl = urlData.publicUrl;
        }

        const imgRes = await fetch(imageUrl);
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer();
          const base64 = arrayBufferToBase64(imgBuffer);
          personData.imgBase64 = base64;
          console.log(`Photo converted to base64: ${Math.round(imgBuffer.byteLength / 1024)}KB`);
        } else {
          await imgRes.text();
          console.warn("Photo fetch failed:", imgRes.status);
        }
      } catch (e) {
        console.warn("Failed to fetch photo:", e);
      }
    }

    // Save person to MIPS
    console.log(`Saving person to MIPS: ${name} (${personNo}), type=${person_type}, hasPhoto=${!!personData.imgBase64}`);
    const result = await savePerson(token, personData);

    const mipsPersonId = result.json?.data?.id || result.json?.data?.personId || personNo;

    // Update sync status in database
    await supabase
      .from(tableName)
      .update({
        mips_sync_status: result.success ? "synced" : "failed",
        mips_person_id: result.success ? String(mipsPersonId) : null,
      })
      .eq("id", person_id);

    console.log(`Sync result: success=${result.success}, endpoint=${result.endpoint}, mipsPersonId=${mipsPersonId}`);

    return new Response(JSON.stringify({
      success: result.success,
      mips_person_id: mipsPersonId,
      mips_response: result.json,
      endpoint_used: result.endpoint,
      person: { name, personNo, department: personData.department },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("sync-to-mips error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
