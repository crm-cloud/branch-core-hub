import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TARGET_DEVICE_ID = 13;

let cachedToken: string | null = null;
let tokenExpiry = 0;

function getBaseUrl(): string {
  return Deno.env.get("MIPS_SERVER_URL")!.replace(/\/+$/, "");
}

function stripHyphens(code: string): string {
  return code.replace(/-/g, "");
}

function formatDate(dateStr: string | null, fallbackDate: string): string {
  if (!dateStr) return fallbackDate;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return fallbackDate;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function getRuoYiToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "TENANT-ID": "1" },
    body: JSON.stringify({
      username: Deno.env.get("MIPS_USERNAME")!,
      password: Deno.env.get("MIPS_PASSWORD")!,
    }),
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch {
    throw new Error(`RuoYi login non-JSON: ${text.substring(0, 300)}`);
  }
  if (json.code !== 200 && json.code !== 0) {
    throw new Error(`RuoYi login failed: ${json.msg || JSON.stringify(json)}`);
  }
  cachedToken = json.token || json.data?.token;
  if (!cachedToken) throw new Error("No token in login response");
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

/** Lookup person by personSn, returns full person object or null */
async function lookupPerson(baseUrl: string, token: string, personSn: string): Promise<any | null> {
  const res = await fetch(
    `${baseUrl}/personInfo/person/list?personSn=${personSn}&pageNum=1&pageSize=5`,
    { method: "GET", headers: authHeaders(token) }
  );
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { return null; }
  const rows = json?.rows || json?.data;
  if (!Array.isArray(rows)) return null;
  return rows.find((r: any) => r.personSn === personSn) || null;
}

/** Create or update person — returns personId (looked up after create since POST returns no ID) */
async function upsertPerson(
  baseUrl: string,
  token: string,
  payload: Record<string, unknown>,
  existingPersonId: number | null
): Promise<{ success: boolean; personId: number | null; response: any }> {
  const isUpdate = existingPersonId !== null;
  const method = isUpdate ? "PUT" : "POST";
  
  if (isUpdate) {
    payload.personId = existingPersonId;
  }

  // Remove photo fields — photos must be uploaded separately via multipart
  delete payload.personPhotoUrl;
  delete payload.photoUrl;
  delete payload.photoUri;

  console.log(`${method} /personInfo/person — personSn=${payload.personSn}, isUpdate=${isUpdate}`);

  const res = await fetch(`${baseUrl}/personInfo/person`, {
    method,
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log(`Person ${method} response: ${text.substring(0, 500)}`);

  let json: any;
  try { json = JSON.parse(text); } catch {
    return { success: false, personId: null, response: { raw: text } };
  }

  // MIPS wraps errors in HTTP 200 — only check json.code
  const success = json.code === 200 || json.code === 0;
  if (!success) {
    return { success: false, personId: existingPersonId, response: json };
  }

  // POST returns no personId — must look up afterward
  if (!isUpdate) {
    const found = await lookupPerson(baseUrl, token, String(payload.personSn));
    return { success: true, personId: found?.personId || null, response: json };
  }

  return { success: true, personId: existingPersonId, response: json };
}

/** Upload photo via multipart/form-data to MIPS */
async function uploadPhoto(
  baseUrl: string,
  token: string,
  personId: number,
  photoUrl: string
): Promise<{ success: boolean; message: string }> {
  if (!photoUrl) return { success: false, message: "No photo URL" };

  try {
    // Resolve relative URLs
    let url = photoUrl;
    if (!url.startsWith("http")) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      url = `${supabaseUrl}/storage/v1/object/public/${url}`;
    }

    console.log(`Fetching photo from: ${url}`);
    const photoRes = await fetch(url);
    if (!photoRes.ok) {
      return { success: false, message: `Photo fetch failed: ${photoRes.status}` };
    }

    const photoBytes = new Uint8Array(await photoRes.arrayBuffer());
    if (photoBytes.length > 500 * 1024) {
      return { success: false, message: `Photo too large: ${Math.round(photoBytes.length / 1024)}KB` };
    }

    console.log(`Photo fetched: ${Math.round(photoBytes.length / 1024)}KB`);

    // Build multipart/form-data
    const boundary = `----FormBoundary${Date.now()}`;
    const contentType = photoRes.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";

    const preamble = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="person_${personId}.${ext}"`,
      `Content-Type: ${contentType}`,
      "",
      "",
    ].join("\r\n");

    const postamble = `\r\n--${boundary}--\r\n`;

    const preambleBytes = new TextEncoder().encode(preamble);
    const postambleBytes = new TextEncoder().encode(postamble);

    const body = new Uint8Array(preambleBytes.length + photoBytes.length + postambleBytes.length);
    body.set(preambleBytes, 0);
    body.set(photoBytes, preambleBytes.length);
    body.set(postambleBytes, preambleBytes.length + photoBytes.length);

    // Try POST /personInfo/person/importPhoto with personId as query param
    const uploadUrl = `${baseUrl}/personInfo/person/importPhoto?personId=${personId}`;
    console.log(`Uploading photo to: ${uploadUrl}`);

    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "TENANT-ID": "1",
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: body,
    });

    const uploadText = await uploadRes.text();
    console.log(`Photo upload response: ${uploadText.substring(0, 300)}`);

    let uploadJson: any;
    try { uploadJson = JSON.parse(uploadText); } catch {
      // If importPhoto doesn't work, try PUT with base64 in personPhotoUrl
      return await uploadPhotoViaBase64(baseUrl, token, personId, photoBytes, contentType);
    }

    if (uploadJson.code === 200 || uploadJson.code === 0) {
      return { success: true, message: "Photo uploaded via multipart" };
    }

    // Fallback: try base64 approach via PUT
    return await uploadPhotoViaBase64(baseUrl, token, personId, photoBytes, contentType);
  } catch (e) {
    console.warn("Photo upload error:", e);
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Fallback: try updating person with base64 photo in various field names */
async function uploadPhotoViaBase64(
  baseUrl: string,
  token: string,
  personId: number,
  photoBytes: Uint8Array,
  contentType: string
): Promise<{ success: boolean; message: string }> {
  // Convert to base64
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < photoBytes.length; i += chunkSize) {
    const chunk = photoBytes.subarray(i, Math.min(i + chunkSize, photoBytes.length));
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);

  // Try different field names that RuoYi might accept
  const attempts = [
    { personPhotoUrl: `data:${contentType};base64,${base64}` },
    { photoUri: `data:${contentType};base64,${base64}` },
    { personPhotoUrl: base64 },  // raw base64 without data URI prefix
  ];

  for (const photoField of attempts) {
    const res = await fetch(`${baseUrl}/personInfo/person`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ personId, ...photoField }),
    });
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { continue; }
    if (json.code === 200 || json.code === 0) {
      // Verify photo was actually saved
      const person = await fetch(`${baseUrl}/personInfo/person/${personId}`, {
        method: "GET",
        headers: authHeaders(token),
      });
      const pText = await person.text();
      try {
        const pJson = JSON.parse(pText);
        if (pJson.data?.photoUri || pJson.data?.havePhoto) {
          return { success: true, message: "Photo uploaded via base64 PUT" };
        }
      } catch {}
    }
  }

  return { success: false, message: "All photo upload methods failed — photo must be uploaded via MIPS web UI" };
}

/** Dispatch person to device */
async function dispatchToDevice(
  baseUrl: string,
  token: string,
  personId: number,
  deviceId: number
): Promise<any> {
  console.log(`Dispatching personId=${personId} to device ${deviceId}`);
  const res = await fetch(`${baseUrl}/through/device/syncPerson`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      personId: personId,
      deviceIds: [deviceId],
      deviceNumType: "4",
    }),
  });
  const text = await res.text();
  console.log(`Dispatch response: ${text.substring(0, 300)}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
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

    const token = await getRuoYiToken();
    const baseUrl = getBaseUrl();

    // ── Verify-only mode ──
    if (verify_only && person_no) {
      const stripped = stripHyphens(person_no);
      const found = await lookupPerson(baseUrl, token, stripped);
      return new Response(JSON.stringify({
        verified: !!found,
        mips_person: found || null,
        person_no_searched: stripped,
        has_photo: !!(found?.photoUri || found?.havePhoto),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Full sync mode ──
    if (!person_id || !person_type) {
      return new Response(JSON.stringify({ error: "Missing person_id or person_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Fetch CRM data
    let name = "Unknown";
    let personNo = "";
    let phone = "";
    let email = "";
    let photoUrl = "";
    let validTimeBegin = "2024-01-01 00:00:00";
    let validTimeEnd = "2030-12-31 23:59:59";
    let tableName: string;
    let deptId = 100; // 100=Member, 101=Staff

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

      // Get membership dates for access validity
      const { data: membership } = await supabase
        .from("memberships")
        .select("start_date, end_date")
        .eq("member_id", person_id)
        .eq("status", "active")
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (membership) {
        validTimeBegin = formatDate(membership.start_date + "T00:00:00", validTimeBegin);
        validTimeEnd = formatDate(membership.end_date + "T23:59:59", validTimeEnd);
      }
    } else {
      tableName = "employees";
      deptId = 101; // Staff department
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

    const mipsPersonSn = stripHyphens(personNo);
    console.log(`Syncing ${person_type}: ${name} (${personNo} → ${mipsPersonSn})`);

    // Step 2: Check if person already exists in MIPS
    const existing = await lookupPerson(baseUrl, token, mipsPersonSn);
    const existingPersonId = existing?.personId || null;
    console.log(`MIPS lookup: ${existing ? `found personId=${existingPersonId}` : "not found"}`);

    // Step 3: Create or update person
    const personPayload: Record<string, unknown> = {
      personSn: mipsPersonSn,
      personType: 1,
      deptId,
      name,
      mobile: phone,
      email: email || undefined,
      gender: "M",
      attendance: "1",
      holiday: "1",
      validTimeBegin,
      validTimeEnd,
      remark: person_type === "member" ? "Gym Member" : "Staff",
    };

    const { success, personId, response: mipsResponse } = await upsertPerson(
      baseUrl, token, personPayload, existingPersonId
    );

    if (!success) {
      console.error(`MIPS upsert FAILED: ${JSON.stringify(mipsResponse)}`);
      await supabase.from(tableName).update({
        mips_sync_status: "failed",
        mips_person_id: null,
      }).eq("id", person_id);

      return new Response(JSON.stringify({
        success: false,
        error: mipsResponse?.msg || "MIPS person create/update failed",
        mips_response: mipsResponse,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!personId) {
      console.error("Person created but personId not found in lookup");
      await supabase.from(tableName).update({
        mips_sync_status: "failed",
        mips_person_id: null,
      }).eq("id", person_id);

      return new Response(JSON.stringify({
        success: false,
        error: "Person created but personId not retrievable",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`MIPS person ${existing ? "updated" : "created"}: personId=${personId}`);

    // Step 4: Upload photo (separate step)
    let photoResult = { success: false, message: "No photo available" };
    if (photoUrl) {
      photoResult = await uploadPhoto(baseUrl, token, personId, photoUrl);
      console.log(`Photo upload: ${photoResult.success ? "✓" : "✗"} ${photoResult.message}`);
    }

    // Step 5: Dispatch to device
    let dispatchResult: any = null;
    try {
      dispatchResult = await dispatchToDevice(baseUrl, token, personId, TARGET_DEVICE_ID);
    } catch (e) {
      console.error("Dispatch error:", e);
      dispatchResult = { error: String(e) };
    }

    // Step 6: Update CRM database with real personId
    await supabase.from(tableName).update({
      mips_sync_status: "synced",
      mips_person_id: String(personId),
    }).eq("id", person_id);

    return new Response(JSON.stringify({
      success: true,
      mips_person_id: personId,
      action: existing ? "updated" : "created",
      photo_result: photoResult,
      dispatch_result: dispatchResult,
      validity: { validTimeBegin, validTimeEnd },
      person: { name, personSn: mipsPersonSn, originalCode: personNo },
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
