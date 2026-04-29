// v1.0.0 — HOWBODY posture report push receiver (PUBLIC)
import { corsHeaders, json, admin, logWebhook } from "../_shared/howbody.ts";

const ENVELOPE_OK = { code: 200, message: "Push successful", data: null };
const ENVELOPE_FAIL = { code: 500, message: "Push failed", data: null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const expectedKey = Deno.env.get("HOWBODY_APPKEY");
    const sentKey = req.headers.get("appkey") || req.headers.get("Appkey") || req.headers.get("APPKEY");
    if (!expectedKey || sentKey !== expectedKey) {
      await logWebhook("posture", null, null, 401, "appkey mismatch", null);
      return json({ code: 401, message: "Unauthorized", data: null }, 401);
    }

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") return json(ENVELOPE_FAIL, 400);

    const thirdUid = payload.thirdUid as string | undefined;
    const dataKey = payload.dataKey as string | undefined;
    if (!thirdUid || !dataKey) {
      await logWebhook("posture", thirdUid ?? null, dataKey ?? null, 400, "missing thirdUid/dataKey", payload);
      return json(ENVELOPE_FAIL, 400);
    }

    const sb = admin();
    const { data: member } = await sb
      .from("members")
      .select("id")
      .eq("howbody_third_uid", thirdUid)
      .maybeSingle();
    if (!member) {
      await logWebhook("posture", thirdUid, dataKey, 404, "member not found", payload);
      return json(ENVELOPE_FAIL, 404);
    }

    const testTime = payload.testTime ? new Date(Number(payload.testTime) * 1000).toISOString() : null;
    const num = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));

    await sb.from("howbody_posture_reports").upsert({
      member_id: member.id,
      data_key: dataKey,
      equipment_no: payload.equipmentNo ?? null,
      scan_id: payload.scanId ?? null,
      test_time: testTime,
      score: num(payload.score),
      head_forward: num(payload.headForward),
      head_slant: num(payload.headSlant),
      shoulder_left: num(payload.shoulderLeft),
      shoulder_right: num(payload.shoulderRight),
      high_low_shoulder: num(payload.highLowShoulder),
      pelvis_forward: num(payload.pelvisForward),
      knee_left: num(payload.kneeLeft),
      knee_right: num(payload.kneeRight),
      leg_left: num(payload.legLeft),
      leg_right: num(payload.legRight),
      body_slope: num(payload.bodySlope),
      bust: num(payload.bust),
      waist: num(payload.waist),
      hip: num(payload.hip),
      left_thigh: num(payload.leftThigh),
      right_thigh: num(payload.rightThigh),
      calf_left: num(payload.calfLeft),
      calf_right: num(payload.calfRight),
      shoulder_back: num(payload.shoulderBack),
      up_arm_left: num(payload.upArmLeft),
      up_arm_right: num(payload.upArmRight),
      front_img: payload.frontImg ?? null,
      left_img: payload.leftImg ?? null,
      right_img: payload.rightImg ?? null,
      back_img: payload.backImg ?? null,
      model_url: payload.murl ?? null,
      full_payload: payload,
    }, { onConflict: "data_key" });

    if (payload.scanId) {
      await sb.from("howbody_scan_sessions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("scan_id", payload.scanId);
    }

    await logWebhook("posture", thirdUid, dataKey, 200, "ok", null);
    return json(ENVELOPE_OK, 200);
  } catch (e) {
    console.error("howbody-posture-webhook error:", e);
    await logWebhook("posture", null, null, 500, e instanceof Error ? e.message : "error", null);
    return json(ENVELOPE_FAIL, 500);
  }
});
