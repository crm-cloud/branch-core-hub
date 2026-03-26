import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TARGET_DEVICE_SN = "D1146D682A96B1C2";

let cachedToken: string | null = null;
let tokenExpiry = 0;

function getBaseUrl(): string {
  return Deno.env.get("MIPS_SERVER_URL")!.replace(/\/+$/, "");
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

function stripHyphens(code: string): string {
  return code.replace(/-/g, "");
}

async function getMIPSToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const MIPS_USER = Deno.env.get("MIPS_USERNAME")!;
  const MIPS_PASS = Deno.env.get("MIPS_PASSWORD")!;
  const baseUrl = getBaseUrl();

  const res = await fetch(`${baseUrl}/apiExternal/generateToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ identity: MIPS_USER, pStr: MIPS_PASS }),
  });

  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch {
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

/** Fetch photo from Supabase Storage, return base64 string if under 400KB */
async function fetchPhotoAsBase64(photoUrl: string): Promise<string | null> {
  if (!photoUrl) return null;

  try {
    // Make the URL absolute if it's a relative storage path
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

    // Check size — must be under 400KB
    if (bytes.length > 400 * 1024) {
      console.warn(`Photo too large (${Math.round(bytes.length / 1024)}KB > 400KB), skipping. Compress client-side first.`);
      return null;
    }

    // Convert to base64
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);

    // Determine mime type from content-type header or default to jpeg
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const dataUri = `data:${contentType};base64,${base64}`;

    console.log(`Photo fetched: ${Math.round(bytes.length / 1024)}KB, base64 length: ${dataUri.length}`);
    return dataUri;
  } catch (e) {
    console.warn("Photo fetch error:", e);
    return null;
  }
}

/** Fetch online devices and find the target device by SN */
async function findTargetDeviceId(baseUrl: string, token: string, targetSN: string): Promise<number | null> {
  try {
    const res = await fetch(`${baseUrl}/admin/devices/list/online`, {
      method: "GET",
      headers: {
        "Owl-Auth-Token": token,
        "Accept": "application/json",
        "siteId": "1",
      },
    });
    const json = await res.json();
    if (Number(json.code) === 200 && Array.isArray(json.data)) {
      const target = json.data.find((d: any) => d.deviceKey === targetSN);
      if (target) {
        console.log(`Found target device ${targetSN} with MIPS id: ${target.id}`);
        return Number(target.id);
      }
      // Fallback: return all online device IDs
      console.warn(`Target device ${targetSN} not found among ${json.data.length} online devices`);
      const allIds = json.data.map((d: any) => Number(d.id)).filter((id: number) => !isNaN(id));
      return allIds.length > 0 ? allIds[0] : null;
    }
    return null;
  } catch (e) {
    console.warn("Error finding target device:", e);
    return null;
  }
}

/** Dispatch person to device via Personnel Issue (permission endpoint) */
async function dispatchToDevice(
  baseUrl: string, token: string, mipsPersonId: string, deviceIds: number[]
): Promise<{ success: boolean; response?: any }> {
  if (deviceIds.length === 0) {
    console.log("No device IDs to dispatch to");
    return { success: false, response: { msg: "No devices available" } };
  }

  try {
    console.log(`Dispatching person ${mipsPersonId} to devices: [${deviceIds.join(", ")}]`);
    const res = await fetch(`${baseUrl}/admin/person/employees/permission`, {
      method: "POST",
      headers: {
        "Owl-Auth-Token": token,
        "Content-Type": "application/json",
        "siteId": "1",
      },
      body: JSON.stringify({
        dealWithType: 1,
        ids: [String(mipsPersonId)],
        deviceIds,
        passTimes: [],
        passDealType: 1,
      }),
    });
    const json = await res.json();
    const ok = Number(json.code) === 200;
    console.log(`Dispatch result: success=${ok}, response: ${JSON.stringify(json).substring(0, 300)}`);
    return { success: ok, response: json };
  } catch (e) {
    console.error("Dispatch error:", e);
    return { success: false, response: { error: String(e) } };
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

      // Try biometric photo first, then avatar
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

    // Strip hyphens for MIPS compatibility
    const mipsPersonNo = stripHyphens(personNo);
    console.log(`PersonNo: ${personNo} → MIPS personNo: ${mipsPersonNo}`);

    // Step 1: Fetch and encode photo
    const photoBase64 = await fetchPhotoAsBase64(photoUrl);
    const hasPhoto = !!photoBase64;
    console.log(`Photo available: ${hasPhoto}${hasPhoto ? "" : " (no photo URL or fetch failed)"}`);

    // Build MIPS payload with photo if available
    const mipsPayload = {
      id: "",
      personNo: mipsPersonNo,
      name,
      idCard: "",
      beginTime: nowFormatted(),
      expireTime,
      groupId: "",
      gender: 1,
      phone,
      email,
      birthday: "",
      entryDate: nowFormatted().split(" ")[0] + " 00:00:00",
      attendanceFlag: true,
      attendanceRuleId: 1,
      temperatureAlarm: false,
      noticeEmailList: "",
      vaccination: 1,
      vaccinationTime: "",
      secondContact: "",
      remark: person_type === "member" ? "Gym Member" : "Staff",
      ruleA: "",
      ruleB: "",
      ruleC: "",
      personPhotoId: [],
      personPhotoUrl: hasPhoto ? [photoBase64] : [],
    };

    const baseUrl = getBaseUrl();
    const saveUrl = `${baseUrl}/admin/person/employees`;

    console.log(`Saving person to MIPS: ${name} (${mipsPersonNo}), type=${person_type}, hasPhoto=${hasPhoto}`);

    const res = await fetch(saveUrl, {
      method: "POST",
      headers: {
        "Owl-Auth-Token": token,
        "Content-Type": "application/json",
        "siteId": "1",
      },
      body: JSON.stringify(mipsPayload),
    });

    const responseText = await res.text();
    console.log(`MIPS response status: ${res.status}, body: ${responseText.substring(0, 500)}`);

    let responseJson: any;
    try { responseJson = JSON.parse(responseText); } catch {
      throw new Error(`MIPS returned non-JSON (status ${res.status}): ${responseText.substring(0, 300)}`);
    }

    const code = Number(responseJson.code);
    const success = code === 200 || code === 0 || res.ok;
    const mipsPersonId = responseJson?.data?.id || responseJson?.data?.personId || mipsPersonNo;

    // Update sync status in database
    await supabase
      .from(tableName)
      .update({
        mips_sync_status: success ? "synced" : "failed",
        mips_person_id: success ? String(mipsPersonId) : null,
      })
      .eq("id", person_id);

    // Step 2: Auto-dispatch to target device after successful sync
    let dispatchResult: any = null;
    if (success) {
      console.log(`Auto-dispatching to target device SN: ${TARGET_DEVICE_SN}...`);
      const targetDeviceId = await findTargetDeviceId(baseUrl, token, TARGET_DEVICE_SN);

      if (targetDeviceId) {
        dispatchResult = await dispatchToDevice(baseUrl, token, String(mipsPersonId), [targetDeviceId]);
        console.log(`Dispatch to ${TARGET_DEVICE_SN}: success=${dispatchResult.success}`);
      } else {
        console.warn(`Target device ${TARGET_DEVICE_SN} is offline or not found. Dispatch skipped.`);
        dispatchResult = { success: false, response: { msg: `Device ${TARGET_DEVICE_SN} offline` } };
      }
    }

    console.log(`Sync result: success=${success}, mipsPersonId=${mipsPersonId}, hasPhoto=${hasPhoto}`);

    return new Response(JSON.stringify({
      success,
      mips_person_id: mipsPersonId,
      mips_response: responseJson,
      photo_included: hasPhoto,
      dispatch_result: dispatchResult,
      endpoint_used: saveUrl,
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
