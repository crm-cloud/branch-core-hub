// v2.0.0 — Routes through canonical dispatch-communication funnel.
// Sends a Google review request to a 4-5★ feedback author via WhatsApp/SMS/email.
// Idempotent per feedback_id+channel via dedupe_key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Channel = "whatsapp" | "sms" | "email" | "in_app";

interface Body {
  feedback_id: string;
  channel?: Channel;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = (await req.json()) as Body;
    if (!body?.feedback_id) {
      return json({ error: "feedback_id required" }, 400);
    }

    const { data: fb, error: fbErr } = await supabase
      .from("feedback")
      .select("id, rating, branch_id, member_id")
      .eq("id", body.feedback_id)
      .maybeSingle();

    if (fbErr || !fb) return json({ error: "feedback not found" }, 404);
    if (fb.rating == null || fb.rating < 4) {
      return json({ error: "Google reviews only for 4-5★ feedback" }, 422);
    }

    const { data: branch } = await supabase
      .from("branches")
      .select("id, name, google_review_link")
      .eq("id", fb.branch_id)
      .maybeSingle();

    if (!branch?.google_review_link) {
      return json({
        error: "This branch has no Google review link configured. Add it under Settings → Branches → Google Reviews.",
      }, 412);
    }

    let memberPhone: string | null = null;
    let memberEmail: string | null = null;
    let memberName: string | null = null;
    if (fb.member_id) {
      const { data: m } = await supabase
        .from("members")
        .select("phone, email, user_id")
        .eq("id", fb.member_id)
        .maybeSingle();
      memberPhone = m?.phone ?? null;
      memberEmail = m?.email ?? null;
      if (m?.user_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", m.user_id)
          .maybeSingle();
        memberName = p?.full_name ?? null;
      }
    }

    const channel: Channel =
      body.channel ?? (memberPhone ? "whatsapp" : memberEmail ? "email" : "in_app");

    const recipient =
      channel === "email" ? memberEmail :
      channel === "in_app" ? (fb.member_id ?? "") :
      memberPhone;

    if (!recipient) {
      return json({ error: `No recipient for channel ${channel}` }, 412);
    }

    const link = `${SUPABASE_URL}/functions/v1/google-review-redirect?f=${fb.id}`;
    const message = `Hi ${memberName ?? "there"}, thanks for the ${fb.rating}★ feedback at ${branch.name}! If we earned it, would you mind sharing a quick Google review? It helps us a lot 🙏 ${link}`;

    // ── Route through canonical dispatcher ──
    const dispatchRes = await supabase.functions.invoke("dispatch-communication", {
      body: {
        branch_id: branch.id,
        channel,
        category: "review_request",
        recipient,
        member_id: fb.member_id,
        payload: {
          subject: `Quick favor — share your experience at ${branch.name}?`,
          body: message,
          variables: { branch_name: branch.name, rating: fb.rating, link },
        },
        dedupe_key: `greview:${fb.id}:${channel}`,
        ttl_seconds: 7 * 24 * 3600, // never re-ask within a week
      },
    });

    if (dispatchRes.error) {
      throw new Error(dispatchRes.error.message);
    }

    const result = dispatchRes.data as {
      status: string; log_id?: string; reason?: string;
    };

    const sendOk = result.status === "sent" || result.status === "queued";
    const trackingStatus =
      result.status === "sent" ? "sent" :
      result.status === "queued" ? "queued" :
      result.status === "deduped" ? "sent" : // already requested
      result.status === "suppressed" ? "suppressed" :
      "failed";

    await supabase
      .from("feedback")
      .update({
        google_review_request_status: trackingStatus,
        google_review_request_channel: channel,
        google_review_requested_at: new Date().toISOString(),
        google_review_request_message_id: result.log_id ?? null,
      })
      .eq("id", fb.id);

    return json({
      ok: sendOk,
      status: result.status,
      reason: result.reason,
      channel,
      link,
      log_id: result.log_id,
    });
  } catch (err) {
    console.error("request-google-review error", err);
    const msg = err instanceof Error ? err.message : "unknown";
    return json({ error: msg }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
