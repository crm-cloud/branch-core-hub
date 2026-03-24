import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

async function getMIPSToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const MIPS_URL = Deno.env.get("MIPS_SERVER_URL")!.replace(/\/+$/, "");
  const MIPS_USER = Deno.env.get("MIPS_USERNAME")!;
  const MIPS_PASS = Deno.env.get("MIPS_PASSWORD")!;
  const urlObj = new URL(MIPS_URL);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

  const res = await fetch(`${baseUrl}/apiExternal/generateToken`, {
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
    throw new Error("MIPS auth endpoint returned non-JSON response (possibly HTML redirect)");
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

    const MIPS_URL = Deno.env.get("MIPS_SERVER_URL")!.replace(/\/+$/, "");
    const mipsUrlObj = new URL(MIPS_URL);
    const mipsBase = `${mipsUrlObj.protocol}//${mipsUrlObj.host}`;
    const token = await getMIPSToken();

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
        department: "Normal User",
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

      const dept = emp.department?.toLowerCase().includes("manager") ? "Administrator" : "Employee";

      personData = {
        name,
        personNo,
        phone: profile?.phone || "",
        department: dept,
        expireTime: "2030-12-31 23:59:59",
      };
    }

    // Download and convert photo to base64 using chunked encoder
    if (photoUrl) {
      try {
        let imageUrl = photoUrl;
        if (photoUrl.startsWith("member-photos/") || photoUrl.startsWith("avatars/")) {
          const { data: urlData } = supabase.storage
            .from(photoUrl.startsWith("member-photos/") ? "member-photos" : "avatars")
            .getPublicUrl(photoUrl.replace(/^(member-photos|avatars)\//, ""));
          imageUrl = urlData.publicUrl;
        }

        const imgRes = await fetch(imageUrl);
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer();
          const base64 = arrayBufferToBase64(imgBuffer);
          (personData as any).imgBase64 = base64;
          console.log(`Photo converted to base64: ${Math.round(imgBuffer.byteLength / 1024)}KB`);
        } else {
          await imgRes.text(); // consume body
          console.warn("Photo fetch failed:", imgRes.status);
        }
      } catch (e) {
        console.warn("Failed to fetch photo for MIPS sync:", e);
      }
    }

    // Send as JSON to MIPS API (more reliable for base64 payloads)
    const addRes = await fetch(`${mipsBase}/admin/person/employees/save`, {
      method: "POST",
      headers: {
        "owl-auth-token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(personData),
    });

    // Safely parse response — handle HTML error pages
    const responseText = await addRes.text();
    let addJson: any;
    try {
      addJson = JSON.parse(responseText);
    } catch {
      console.error("MIPS add-person returned non-JSON:", responseText.substring(0, 500));
      // Try alternate endpoint
      console.log("Trying alternate endpoint /api/person/add ...");
      const altRes = await fetch(`${mipsBase}/api/person/add`, {
        method: "POST",
        headers: {
          "owl-auth-token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(personData),
      });
      const altText = await altRes.text();
      try {
        addJson = JSON.parse(altText);
        console.log("Alternate endpoint succeeded:", JSON.stringify(addJson));
      } catch {
        console.error("Alternate endpoint also returned non-JSON:", altText.substring(0, 500));
        throw new Error(`MIPS API returned HTML instead of JSON. Status: ${addRes.status}. First endpoint: /admin/person/employees/save returned HTML. Alternate: /api/person/add also failed. The server may need a different endpoint path.`);
      }
    }

    console.log("MIPS add person response:", JSON.stringify(addJson));

    const success = addJson.code === 200 || addJson.code === 0 || addRes.ok;
    const mipsPersonId = addJson.data?.id || addJson.data?.personId || personNo;

    // Update sync status
    await supabase
      .from(tableName)
      .update({
        mips_sync_status: success ? "synced" : "failed",
        mips_person_id: success ? String(mipsPersonId) : null,
      })
      .eq("id", person_id);

    return new Response(JSON.stringify({
      success,
      mips_person_id: mipsPersonId,
      mips_response: addJson,
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
