import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TARGET_DEVICE_ID = 13; // Device D1146D682A96B1C2 = MIPS deviceId 13

let cachedToken: string | null = null;
let tokenExpiry = 0;

function getBaseUrl(): string {
  return Deno.env.get("MIPS_SERVER_URL")!.replace(/\/+$/, "");
}

function stripHyphens(code: string): string {
  return code.replace(/-/g, "");
}

function formatDateTime(dateStr: string | null, fallback: string): string {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return fallback;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function nowFormatted(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function getRuoYiToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const username = Deno.env.get("MIPS_USERNAME")!;
  const password = Deno.env.get("MIPS_PASSWORD")!;
  const baseUrl = getBaseUrl();

  const res = await fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "TENANT-ID": "1" },
    body: JSON.stringify({ username, password }),
  });

  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch {
    throw new Error(`RuoYi login returned non-JSON: ${text.substring(0, 300)}`);
  }

  if (json.code !== 200 && json.code !== 0) {
    throw new Error(`RuoYi login failed (code=${json.code}): ${json.msg || JSON.stringify(json)}`);
  }

  cachedToken = json.token || json.data?.token;
  if (!cachedToken) throw new Error("No token in RuoYi login response");
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return cachedToken!;
}

function authHeaders(token: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${token}`,
    "TENANT-ID": "1",
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

/** Fetch photo from Supabase Storage, return base64 string if under 400KB */
async function fetchPhotoAsBase64(photoUrl: string): Promise<string | null> {
  if (!photoUrl) return null;

  try {
    let url = photoUrl;
    if (!url.startsWith("http")) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      url = `${supabaseUrl}/storage/v1/object/public/${url}`;
    }

    console.log(`Fetching photo from: ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Photo fetch failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (bytes.length > 400 * 1024) {
      console.warn(`Photo too large (${Math.round(bytes.length / 1024)}KB > 400KB), skipping.`);
      return null;
    }

    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const dataUri = `data:${contentType};base64,${base64}`;

    console.log(`Photo fetched: ${Math.round(bytes.length / 1024)}KB`);
    return dataUri;
  } catch (e) {
    console.warn("Photo fetch error:", e);
    return null;
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
    const { person_type, person_id, branch_id, verify_only, person_no } = body as {
      person_type: "member" | "employee";
      person_id: string;
      branch_id?: string;
      verify_only?: boolean;
      person_no?: string;
    };

    // Verify-only mode: check if person exists in MIPS
    if (verify_only && person_no) {
      const token = await getRuoYiToken();
      const baseUrl = getBaseUrl();
      const stripped = stripHyphens(person_no);
      
      const verifyRes = await fetch(`${baseUrl}/personInfo/person/list?personSn=${stripped}&pageNum=1&pageSize=10`, {
        method: "GET",
        headers: authHeaders(token),
      });
      const verifyText = await verifyRes.text();
      let verifyJson: any;
      try { verifyJson = JSON.parse(verifyText); } catch {
        verifyJson = { raw: verifyText };
      }
      
      const rows = verifyJson?.rows || verifyJson?.data;
      const found = Array.isArray(rows) ? rows.find((r: any) => r.personSn === stripped) : null;
      
      return new Response(JSON.stringify({
        verified: !!found,
        mips_person: found || null,
        person_no_searched: stripped,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!person_id || !person_type) {
      return new Response(JSON.stringify({ error: "Missing person_id or person_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getRuoYiToken();
    const baseUrl = getBaseUrl();
    console.log("RuoYi token acquired successfully");

    let name = "Unknown";
    let personNo = "";
    let phone = "";
    let email = "";
    let photoUrl = "";
    let expireTime = "2030-12-31 00:00:00";
    let tableName: string;

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
      phone = profile?.phone || "";
      email = profile?.email || "";
      photoUrl = member.biometric_photo_url || profile?.avatar_url || "";

      const { data: membership } = await supabase
        .from("memberships")
        .select("end_date")
        .eq("member_id", person_id)
        .eq("status", "active")
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (membership?.end_date) {
        expireTime = formatDateTime(membership.end_date + "T23:59:59", expireTime);
      }
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
      phone = profile?.phone || "";
      email = profile?.email || "";
      photoUrl = profile?.avatar_url || "";
    }

    const mipsPersonNo = stripHyphens(personNo);
    console.log(`PersonNo: ${personNo} → MIPS personNo: ${mipsPersonNo}`);

    // Step 1: Fetch and encode photo
    const photoBase64 = await fetchPhotoAsBase64(photoUrl);
    const hasPhoto = !!photoBase64;
    console.log(`Photo available: ${hasPhoto}`);

    // Step 2: Create/update person via RuoYi API (correct field names for RuoYi-Vue v3)
    const personPayload: Record<string, unknown> = {
      personSn: mipsPersonNo,       // was: personNo — MIPS uses personSn
      personType: 1,                // REQUIRED — 1=employee/member type
      deptId: 100,                  // REQUIRED — default department
      name,
      mobile: phone,                // was: phone — MIPS uses mobile
      email,
      gender: "M",                  // default
      attendance: "1",              // enable attendance
      holiday: "1",                 // enable holiday tracking
      remark: person_type === "member" ? "Gym Member" : "Staff",
    };

    // Include photo if available (strip data URI prefix for raw base64)
    if (hasPhoto && photoBase64) {
      // Try both: MIPS may need raw base64 or data URI
      personPayload.personPhotoUrl = photoBase64;
    }

    console.log(`Creating person in MIPS: ${name} (personSn=${mipsPersonNo})`);
    console.log(`Payload fields: ${Object.keys(personPayload).join(', ')}`);

    const createRes = await fetch(`${baseUrl}/personInfo/person`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(personPayload),
    });

    const createText = await createRes.text();
    console.log(`Person create response: ${createText.substring(0, 500)}`);

    let createJson: any;
    try { createJson = JSON.parse(createText); } catch {
      throw new Error(`MIPS returned non-JSON: ${createText.substring(0, 300)}`);
    }

    // FIXED: Do NOT use createRes.ok — MIPS wraps errors in HTTP 200
    const success = createJson.code === 200 || createJson.code === 0;
    const mipsPersonId = createJson?.data?.personId || createJson?.data?.id || null;

    if (!success) {
      console.error(`MIPS person create FAILED: code=${createJson.code}, msg=${createJson.msg || createJson.message}`);
    } else {
      console.log(`MIPS person created successfully, personId=${mipsPersonId}`);
    }

    // Update sync status in database
    await supabase
      .from(tableName)
      .update({
        mips_sync_status: success ? "synced" : "failed",
        mips_person_id: success ? String(mipsPersonId) : null,
      })
      .eq("id", person_id);

    // Step 3: Dispatch to target device
    let dispatchResult: any = null;
    if (success) {
      console.log(`Dispatching person to device ID ${TARGET_DEVICE_ID}...`);
      try {
        // Use integer personId for dispatch (MIPS requires numeric ID)
        const numericPersonId = parseInt(String(mipsPersonId), 10);
        console.log(`Dispatching personId=${numericPersonId} to device ${TARGET_DEVICE_ID}`);
        const dispatchRes = await fetch(`${baseUrl}/through/device/syncPerson`, {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({
            personId: numericPersonId,
            deviceIds: [TARGET_DEVICE_ID],
          }),
        });

        const dispatchText = await dispatchRes.text();
        console.log(`Dispatch response: ${dispatchText.substring(0, 300)}`);

        try { dispatchResult = JSON.parse(dispatchText); } catch {
          dispatchResult = { raw: dispatchText };
        }
      } catch (e) {
        console.error("Dispatch error:", e);
        dispatchResult = { error: String(e) };
      }
    }

    return new Response(JSON.stringify({
      success,
      mips_person_id: mipsPersonId,
      mips_response: createJson,
      photo_included: hasPhoto,
      dispatch_result: dispatchResult,
      endpoint_used: `${baseUrl}/personInfo/person`,
      person: { name, personNo: mipsPersonNo, originalCode: personNo },
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
