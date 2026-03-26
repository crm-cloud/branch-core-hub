import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEVICE_ACK = JSON.stringify({ result: 1, code: "000" });

function reinsertHyphen(stripped: string): string | null {
  const match = stripped.match(/^([A-Za-z]+)(\d{5})$/);
  if (match) return `${match[1]}-${match[2]}`;
  return null;
}

function mapFaceType(type: string): { result: string; description: string } {
  switch (type) {
    case "face_0":
      return { result: "member", description: "Authorized face scan" };
    case "face_1":
      return { result: "member_denied", description: "Outside allowed passtime" };
    case "face_2":
      return { result: "stranger", description: "Stranger / unrecognized" };
    default:
      return { result: "unknown", description: `Unknown type: ${type}` };
  }
}

async function findPersonByMipsId(supabase: any, mipsPersonId: string) {
  const { data: member } = await supabase
    .from("members")
    .select("id, branch_id, user_id")
    .eq("mips_person_id", mipsPersonId)
    .maybeSingle();
  if (member) return { ...member, type: "member" };

  const { data: emp } = await supabase
    .from("employees")
    .select("id, branch_id, user_id")
    .eq("mips_person_id", mipsPersonId)
    .maybeSingle();
  if (emp) return { ...emp, type: "employee" };

  const { data: trainer } = await supabase
    .from("trainers")
    .select("id, branch_id, user_id")
    .eq("mips_person_id", mipsPersonId)
    .maybeSingle();
  if (trainer) return { ...trainer, type: "trainer" };

  return null;
}

async function findPersonByCode(supabase: any, personCode: string) {
  const { data: member } = await supabase
    .from("members")
    .select("id, branch_id, user_id")
    .eq("member_code", personCode)
    .maybeSingle();
  if (member) return { ...member, type: "member" };

  const hyphenated = reinsertHyphen(personCode);
  if (hyphenated) {
    const { data: memberH } = await supabase
      .from("members")
      .select("id, branch_id, user_id")
      .eq("member_code", hyphenated)
      .maybeSingle();
    if (memberH) return { ...memberH, type: "member" };
  }

  const { data: emp } = await supabase
    .from("employees")
    .select("id, branch_id, user_id")
    .eq("employee_code", personCode)
    .maybeSingle();
  if (emp) return { ...emp, type: "employee" };

  if (hyphenated) {
    const { data: empH } = await supabase
      .from("employees")
      .select("id, branch_id, user_id")
      .eq("employee_code", hyphenated)
      .maybeSingle();
    if (empH) return { ...empH, type: "employee" };
  }

  return null;
}

async function handleMemberCheckin(
  supabase: any,
  memberId: string,
  branchId: string,
  personName: string,
  passType: string,
) {
  let result = "member";
  let message = `Member ${personName} checked in via ${passType}`;

  try {
    const { data: checkinResult } = await supabase.rpc("member_check_in", {
      _member_id: memberId,
      _branch_id: branchId,
      _method: "biometric",
    });
    if (checkinResult && !(checkinResult as any).valid) {
      result = "member_denied";
      message = `${personName}: ${(checkinResult as any).message || "Check-in denied"}`;
    }
  } catch (e) {
    console.warn("Check-in RPC failed:", e);
  }

  return { result, message };
}

async function handleStaffCheckin(supabase: any, userId: string, branchId: string, personName: string) {
  let message = `Staff ${personName} checked in`;

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: existing } = await supabase
      .from("staff_attendance")
      .select("id, check_out")
      .eq("user_id", userId)
      .gte("check_in", todayStart.toISOString())
      .is("check_out", null)
      .maybeSingle();

    if (existing) {
      await supabase.from("staff_attendance").update({ check_out: new Date().toISOString() }).eq("id", existing.id);
      message = `Staff ${personName} checked out`;
    } else {
      await supabase.from("staff_attendance").insert({
        user_id: userId,
        branch_id: branchId,
        check_in: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn("Staff attendance failed:", e);
  }

  return message;
}

async function handleImgRegCallback(supabase: any, payload: Record<string, unknown>) {
  const personNo = String(payload.personNo || payload.personSn || "");
  const imgUri = String(payload.imgUri || payload.photoUri || "");
  const imgBase64 = String(payload.imgBase64 || payload.base64 || "");

  if (!personNo) {
    console.warn("ImgReg callback missing personNo");
    return;
  }

  console.log(`ImgReg callback for ${personNo}, imgUri=${imgUri ? "yes" : "no"}, base64=${imgBase64 ? "yes" : "no"}`);

  let person = await findPersonByMipsId(supabase, personNo);
  if (!person) person = await findPersonByCode(supabase, personNo);
  if (!person) {
    console.warn(`ImgReg: person ${personNo} not found in CRM`);
    return;
  }

  if (imgBase64 && imgBase64.length > 100) {
    try {
      const binaryStr = atob(imgBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      const filePath = `${person.id}_capture.jpg`;
      await supabase.storage.from("member-photos").upload(filePath, bytes, { upsert: true, contentType: "image/jpeg" });

      const { data: urlData } = supabase.storage.from("member-photos").getPublicUrl(filePath);

      const table = person.type === "member" ? "members" : person.type === "trainer" ? "trainers" : "employees";
      await supabase.from(table).update({ biometric_photo_url: urlData.publicUrl }).eq("id", person.id);
      console.log(`ImgReg: saved captured photo for ${personNo} → ${urlData.publicUrl}`);
    } catch (e) {
      console.warn("ImgReg photo save failed:", e);
    }
  } else if (imgUri) {
    const table = person.type === "member" ? "members" : person.type === "trainer" ? "trainers" : "employees";
    await supabase.from(table).update({ biometric_photo_url: imgUri }).eq("id", person.id);
    console.log(`ImgReg: stored imgUri for ${personNo} → ${imgUri}`);
  }
}

/**
 * Resolve the MIPS server relay URL for a given branch.
 * Tries mips_connections first, falls back to env var.
 */
async function getRelayUrl(supabase: any, branchId: string | null): Promise<string | null> {
  if (branchId) {
    const { data: conn } = await supabase
      .from("mips_connections")
      .select("server_url")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .maybeSingle();
    if (conn?.server_url) return conn.server_url.replace(/\/+$/, "");
  }
  const envUrl = Deno.env.get("MIPS_SERVER_URL");
  return envUrl ? envUrl.replace(/\/+$/, "") : null;
}

/**
 * Forward the original payload to the MIPS server's internal callback.
 * Tries multiple known callback paths for compatibility across MIPS versions.
 */
function relayToMips(mipsServerUrl: string, payload: Record<string, unknown>, eventType: string) {
  // Determine the correct relay path based on event type
  const callbackPaths: string[] = [];
  if (eventType === "ImgReg" || eventType === "img_reg" || eventType === "register") {
    callbackPaths.push("/api/callback/imgReg", "/tdx-admin/api/callback/imgReg");
  } else {
    // Face scan / attendance callbacks
    callbackPaths.push("/api/callback/identify", "/tdx-admin/api/callback/identity");
  }

  // Fire-and-forget: try the primary path
  const primaryUrl = `${mipsServerUrl}${callbackPaths[0]}`;
  console.log(`Relay forwarding to: ${primaryUrl}`);
  fetch(primaryUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((e) => console.warn("Relay forward failed:", e));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    let payload: Record<string, unknown>;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else if (contentType.includes("form-urlencoded")) {
      const formData = await req.formData();
      payload = Object.fromEntries(formData.entries());
    } else {
      const text = await req.text();
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }
    }

    // Log EVERY incoming request for debugging
    const reqInfo = {
      method: req.method,
      url: req.url,
      content_type: contentType,
      headers: Object.fromEntries(req.headers.entries()),
      payload_keys: Object.keys(payload),
      timestamp: new Date().toISOString(),
    };
    console.log("=== MIPS WEBHOOK RECEIVED ===");
    console.log("Request info:", JSON.stringify(reqInfo));
    console.log("Full payload:", JSON.stringify(payload));

    // Check for ImgReg (registration photo callback)
    const eventType_raw = String(payload.eventType || payload.event_type || payload.type || "");
    if (eventType_raw === "ImgReg" || eventType_raw === "img_reg" || eventType_raw === "register") {
      await handleImgRegCallback(supabase, payload);
      // Relay to MIPS
      const relayUrl = await getRelayUrl(supabase, null);
      if (relayUrl) relayToMips(relayUrl, payload, eventType_raw);
      return new Response(DEVICE_ACK, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const personNo = String(payload.personNo || payload.personSn || payload.personId || payload.person_no || "");
    const personName = String(payload.personName || payload.name || "Unknown");
    const passType = String(payload.passType || payload.pass_type || payload.type || "face");
    const temperature = payload.temperature ? parseFloat(String(payload.temperature)) : null;
    const deviceName = String(payload.deviceName || payload.device_name || payload.deviceKey || "unknown");
    const deviceKey = String(payload.deviceKey || payload.deviceSn || deviceName);

    // --- FIX START: Parse Unix Milliseconds correctly ---
    const rawTime = payload.createTime || payload.time;
    let scanTime: string;
    if (rawTime && !isNaN(Number(rawTime))) {
      const ts = Number(rawTime);
      // If 13 digits, it's milliseconds. Otherwise, seconds.
      const dateObj = ts > 99999999999 ? new Date(ts) : new Date(ts * 1000);
      scanTime = isNaN(dateObj.getTime()) ? new Date().toISOString() : dateObj.toISOString();
    } else {
      scanTime = typeof rawTime === "string" ? rawTime : new Date().toISOString();
    }
    // --- FIX END ---

    const imgUri = String(payload.imgUri || payload.img_uri || payload.imgBase64 || "");
    const searchScore = payload.searchScore ? parseFloat(String(payload.searchScore)) : null;
    const livenessScore = payload.livenessScore ? parseFloat(String(payload.livenessScore)) : null;

    let eventType: string;
    let faceTypeInfo: { result: string; description: string } | null = null;

    if (passType.startsWith("face_")) {
      faceTypeInfo = mapFaceType(passType);
      eventType = "face_scan";
    } else {
      eventType = passType.includes("face")
        ? "face_scan"
        : passType.includes("finger")
          ? "fingerprint_scan"
          : passType.includes("card")
            ? "card_scan"
            : "identify";
    }

    let memberId: string | null = null;
    let profileId: string | null = null;
    let branchId: string | null = null;
    let result = faceTypeInfo?.result || "stranger";
    let message = faceTypeInfo?.description || `${personName} scanned via ${passType}`;

    const isStranger = passType === "face_2" || personNo === "STRANGERBABY" || !personNo;

    if (personNo && !isStranger) {
      let person = await findPersonByMipsId(supabase, personNo);
      if (!person) {
        person = await findPersonByCode(supabase, personNo);
      }

      if (person) {
        branchId = person.branch_id;
        profileId = person.user_id;

        if (person.type === "member") {
          memberId = person.id;
          const checkin = await handleMemberCheckin(supabase, person.id, person.branch_id, personName, passType);
          result = checkin.result;
          message = checkin.message;
        } else {
          result = person.type === "trainer" ? "trainer" : "staff";
          message = await handleStaffCheckin(supabase, person.user_id, person.branch_id, personName);
        }
      } else {
        console.warn(`Person not found in CRM: personNo=${personNo}, personName=${personName}`);
      }
    }

    // Log to access_logs
    const { error: logError } = await supabase.from("access_logs").insert({
      device_sn: deviceKey,
      event_type: eventType,
      result,
      message,
      member_id: memberId,
      profile_id: profileId,
      branch_id: branchId,
      captured_at: scanTime,
      payload: {
        ...payload,
        temperature,
        img_uri: imgUri,
        search_score: searchScore,
        liveness_score: livenessScore,
        source: "mips_webhook",
      },
    });

    if (logError) {
      console.error("Failed to insert access_log:", logError);
    }

    console.log(`Processed: result=${result}, person=${personNo}, device=${deviceKey}, message=${message}`);

    // Relay: forward to MIPS internal callback (fire-and-forget)
    try {
      const relayUrl = await getRelayUrl(supabase, branchId);
      if (relayUrl) {
        relayToMips(relayUrl, payload, eventType_raw);
      } else {
        console.log("No MIPS relay URL configured — skipping relay");
      }
    } catch (relayErr) {
      console.warn("Relay lookup failed:", relayErr);
    }

    return new Response(DEVICE_ACK, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("mips-webhook-receiver FATAL error:", message);
    // Always return ACK to device even on error
    return new Response(DEVICE_ACK, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
