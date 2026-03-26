import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEVICE_ACK = JSON.stringify({ result: 1, code: "000" });

function reinsertHyphen(stripped: string): string | null {
  const match = stripped.match(/^([A-Za-z]+)(\d{5})$/);
  if (match) return `${match[1]}-${match[2]}`;
  return null;
}

function mapFaceType(type: string): { result: string; description: string } {
  switch (type) {
    case "face_0": return { result: "member", description: "Authorized face scan" };
    case "face_1": return { result: "member_denied", description: "Outside allowed passtime" };
    case "face_2": return { result: "stranger", description: "Stranger / unrecognized" };
    default: return { result: "unknown", description: `Unknown type: ${type}` };
  }
}

async function findPersonByMipsId(supabase: any, mipsPersonId: string) {
  // Try member
  const { data: member } = await supabase
    .from("members")
    .select("id, branch_id, user_id")
    .eq("mips_person_id", mipsPersonId)
    .maybeSingle();
  if (member) return { ...member, type: "member" };

  // Try employee
  const { data: emp } = await supabase
    .from("employees")
    .select("id, branch_id, user_id")
    .eq("mips_person_id", mipsPersonId)
    .maybeSingle();
  if (emp) return { ...emp, type: "employee" };

  // Try trainer
  const { data: trainer } = await supabase
    .from("trainers")
    .select("id, branch_id, user_id")
    .eq("mips_person_id", mipsPersonId)
    .maybeSingle();
  if (trainer) return { ...trainer, type: "trainer" };

  return null;
}

async function findPersonByCode(supabase: any, personCode: string) {
  // Try direct member_code match
  const { data: member } = await supabase
    .from("members")
    .select("id, branch_id, user_id")
    .eq("member_code", personCode)
    .maybeSingle();
  if (member) return { ...member, type: "member" };

  // Try with hyphen re-inserted
  const hyphenated = reinsertHyphen(personCode);
  if (hyphenated) {
    const { data: memberH } = await supabase
      .from("members")
      .select("id, branch_id, user_id")
      .eq("member_code", hyphenated)
      .maybeSingle();
    if (memberH) return { ...memberH, type: "member" };
  }

  // Try employee_code
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

async function handleMemberCheckin(supabase: any, memberId: string, branchId: string, personName: string, passType: string) {
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

/**
 * Staff/trainer attendance: uses staff_attendance table
 * Columns: user_id, branch_id, check_in, check_out
 * Toggle: if open check-in exists → check out, else → check in
 */
async function handleStaffCheckin(supabase: any, userId: string, branchId: string, personName: string) {
  let message = `Staff ${personName} checked in`;

  try {
    // Find open check-in (no check_out) for today
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
      await supabase
        .from("staff_attendance")
        .update({ check_out: new Date().toISOString() })
        .eq("id", existing.id);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

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
      try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
    }

    console.log("MIPS webhook received:", JSON.stringify(payload));

    const personNo = String(payload.personNo || payload.personSn || payload.personId || payload.person_no || "");
    const personName = String(payload.personName || payload.name || "Unknown");
    const passType = String(payload.passType || payload.pass_type || payload.type || "face");
    const temperature = payload.temperature ? parseFloat(String(payload.temperature)) : null;
    const deviceName = String(payload.deviceName || payload.device_name || payload.deviceKey || "unknown");
    const deviceKey = String(payload.deviceKey || payload.deviceSn || deviceName);
    const scanTime = String(payload.createTime || payload.time || new Date().toISOString());
    const imgUri = String(payload.imgUri || payload.img_uri || payload.imgBase64 || "");
    const searchScore = payload.searchScore ? parseFloat(String(payload.searchScore)) : null;
    const livenessScore = payload.livenessScore ? parseFloat(String(payload.livenessScore)) : null;

    let eventType: string;
    let faceTypeInfo: { result: string; description: string } | null = null;

    if (passType.startsWith("face_")) {
      faceTypeInfo = mapFaceType(passType);
      eventType = "face_scan";
    } else {
      eventType = passType.includes("face") ? "face_scan" :
                  passType.includes("finger") ? "fingerprint_scan" :
                  passType.includes("card") ? "card_scan" : "identify";
    }

    let memberId: string | null = null;
    let profileId: string | null = null;
    let branchId: string | null = null;
    let result = faceTypeInfo?.result || "stranger";
    let message = faceTypeInfo?.description || `${personName} scanned via ${passType}`;

    const isStranger = passType === "face_2" || personNo === "STRANGERBABY" || !personNo;

    if (personNo && !isStranger) {
      // Match: try mips_person_id first, then by code
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
          // employee or trainer → staff attendance using user_id
          result = person.type === "trainer" ? "trainer" : "staff";
          message = await handleStaffCheckin(supabase, person.user_id, person.branch_id, personName);
        }
      }
    }

    // Log to access_logs
    await supabase.from("access_logs").insert({
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

    return new Response(DEVICE_ACK, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("mips-webhook-receiver error:", message);
    return new Response(DEVICE_ACK, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
