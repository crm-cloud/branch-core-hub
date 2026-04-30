// v1.0.0 — Bind HOWBODY scanner session to a member (calls /openApi/setUserInfo)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, admin, getHowbodyCreds, howbodyAuthedHeaders } from "../_shared/howbody.ts";

interface BindBody {
  equipmentNo?: string;
  scanId?: string;
  memberId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "Unauthorized" }, 401);

    const sbAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await sbAuth.auth.getClaims(token);
    if (!claims?.claims?.sub) return json({ ok: false, error: "Unauthorized" }, 401);

    const body = (await req.json().catch(() => ({}))) as BindBody;
    const equipmentNo = (body.equipmentNo || "").trim();
    const scanId = (body.scanId || "").trim();
    const memberId = (body.memberId || "").trim();
    if (!equipmentNo || !scanId || !memberId) {
      return json({ ok: false, error: "equipmentNo, scanId and memberId are required" }, 400);
    }

    const sb = admin();

    // Load member + profile
    const { data: member, error: mErr } = await sb
      .from("members")
      .select("id, user_id, status, howbody_third_uid, profiles:user_id(full_name,phone,gender,date_of_birth)")
      .eq("id", memberId)
      .maybeSingle();
    if (mErr || !member) return json({ ok: false, error: "Member not found" }, 404);

    if (member.status && member.status !== "active") {
      return json({ ok: false, error: "Member is not active" }, 403);
    }

    // Unified scan quota: plan benefits + add-on credits (body OR posture)
    const [bodyQ, postureQ] = await Promise.all([
      sb.rpc("howbody_scan_quota", { _member_id: memberId, _kind: "body" }),
      sb.rpc("howbody_scan_quota", { _member_id: memberId, _kind: "posture" }),
    ]);
    const bodyAllowed = (bodyQ.data as any)?.allowed === true;
    const postureAllowed = (postureQ.data as any)?.allowed === true;
    if (!bodyAllowed && !postureAllowed) {
      return json({
        ok: false,
        error: "Your current plan does not include body or posture scans, and you have no add-on scans remaining. Please ask staff.",
        quota: { body: bodyQ.data, posture: postureQ.data },
      }, 403);
    }

    const profile: any = member.profiles || {};
    const sex = profile.gender === "female" ? 0 : 1;
    let age: number | null = null;
    if (profile.date_of_birth) {
      const dob = new Date(profile.date_of_birth);
      const diff = Date.now() - dob.getTime();
      age = Math.max(4, Math.min(99, Math.floor(diff / (365.25 * 24 * 3600 * 1000))));
    }

    // Latest measurement for height
    const { data: meas } = await sb
      .from("member_measurements")
      .select("height_cm")
      .eq("member_id", memberId)
      .not("height_cm", "is", null)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const height = Math.max(80, Math.min(250, Number(meas?.height_cm) || 170));

    // Call HOWBODY setUserInfo
    const { baseUrl } = await getHowbodyCreds();
    const headers = await howbodyAuthedHeaders();
    const hbResp = await fetch(`${baseUrl}/openApi/setUserInfo`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        equipmentNo,
        scanId,
        thirdUid: member.howbody_third_uid,
        nickname: profile.full_name || "Member",
        tel: profile.phone || "",
        sex,
        height,
        age: age ?? 25,
      }),
    });
    const hbBody = await hbResp.json().catch(() => ({}));

    if (hbBody?.code !== 200) {
      // HOWBODY production API returns `msg`; older docs say `message`. Support both.
      const rawMsg = (hbBody?.msg || hbBody?.message || "").toString();
      const lower = rawMsg.toLowerCase();
      const isSessionExpired = lower.includes("session") || rawMsg.includes("会话") || lower.includes("expired");
      const friendly =
        hbBody?.code === 406 ? (isSessionExpired ? "QR session expired — please scan the device QR again" : (rawMsg || "Invalid scan parameters"))
        : hbBody?.code === 401 ? "HOWBODY auth failed — check API credentials"
        : hbBody?.code === 500 ? "Device may be offline. Please ask staff."
        : (rawMsg || "HOWBODY rejected the request");
      return json({ ok: false, error: friendly, code: hbBody?.code, raw: rawMsg }, 502);
    }

    // Persist session
    await sb.from("howbody_scan_sessions").upsert({
      scan_id: scanId,
      equipment_no: equipmentNo,
      member_id: memberId,
      status: "bound",
      bound_at: new Date().toISOString(),
    }, { onConflict: "scan_id" });

    return json({ ok: true });
  } catch (e) {
    console.error("howbody-bind-user error:", e);
    return json({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
