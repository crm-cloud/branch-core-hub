// v1.0.0 — HOWBODY body composition push receiver (PUBLIC)
import { corsHeaders, json, admin, logWebhook } from "../_shared/howbody.ts";

const ENVELOPE_OK = { code: 200, message: "Push successful", data: null };
const ENVELOPE_FAIL = { code: 500, message: "Push failed", data: null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const expectedKey = Deno.env.get("HOWBODY_APPKEY");
    const sentKey = req.headers.get("appkey") || req.headers.get("Appkey") || req.headers.get("APPKEY");
    if (!expectedKey || sentKey !== expectedKey) {
      await logWebhook("body", null, null, 401, "appkey mismatch", null);
      return json({ code: 401, message: "Unauthorized", data: null }, 401);
    }

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return json(ENVELOPE_FAIL, 400);
    }

    const thirdUid = payload.thirdUid as string | undefined;
    const dataKey = payload.dataKey as string | undefined;
    if (!thirdUid || !dataKey) {
      await logWebhook("body", thirdUid ?? null, dataKey ?? null, 400, "missing thirdUid/dataKey", payload);
      return json(ENVELOPE_FAIL, 400);
    }

    const sb = admin();
    const { data: member } = await sb
      .from("members")
      .select("id")
      .eq("howbody_third_uid", thirdUid)
      .maybeSingle();
    if (!member) {
      await logWebhook("body", thirdUid, dataKey, 404, "member not found", payload);
      return json(ENVELOPE_FAIL, 404);
    }

    const testTime = payload.testTime ? new Date(Number(payload.testTime) * 1000).toISOString() : null;
    const num = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));

    await sb.from("howbody_body_reports").upsert({
      member_id: member.id,
      data_key: dataKey,
      equipment_no: payload.equipmentNo ?? null,
      scan_id: payload.scanId ?? null,
      test_time: testTime,
      health_score: num(payload.healthScore),
      weight: num(payload.weight),
      bmi: num(payload.bmi),
      pbf: num(payload.pbf),
      fat: num(payload.fat),
      smm: num(payload.smm),
      tbw: num(payload.tbw),
      pr: num(payload.pr),
      bmr: num(payload.bmr),
      whr: num(payload.whr),
      vfr: num(payload.vfr),
      metabolic_age: payload.metabolicAge ? Math.round(Number(payload.metabolicAge)) : null,
      target_weight: num(payload.targetWeight),
      weight_control: num(payload.weightControl),
      muscle_control: num(payload.muscleControl),
      fat_control: num(payload.fatControl),
      icf: num(payload.icf),
      ecf: num(payload.ecf),
      full_payload: payload,
    }, { onConflict: "data_key" });

    if (payload.scanId) {
      await sb.from("howbody_scan_sessions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("scan_id", payload.scanId);
    }

    await logWebhook("body", thirdUid, dataKey, 200, "ok", null);
    return json(ENVELOPE_OK, 200);
  } catch (e) {
    console.error("howbody-body-webhook error:", e);
    await logWebhook("body", null, null, 500, e instanceof Error ? e.message : "error", null);
    return json(ENVELOPE_FAIL, 500);
  }
});
