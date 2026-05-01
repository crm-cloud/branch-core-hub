// v1.0.0 — Send a Google review request to a member via WhatsApp/SMS/email.
// This NEVER posts a review to Google. It only sends the branch's review link
// (or the deep redirect /r/:feedback_id) and tracks delivery via communication_logs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Channel = "whatsapp" | "sms" | "email" | "in_app";

interface Body {
  feedback_id: string;
  channel?: Channel; // optional override
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = (await req.json()) as Body;
    if (!body?.feedback_id) {
      return new Response(JSON.stringify({ error: "feedback_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load feedback + branch + member
    const { data: fb, error: fbErr } = await supabase
      .from("feedback")
      .select(
        "id, rating, branch_id, member_id, google_review_request_status, google_review_requested_at"
      )
      .eq("id", body.feedback_id)
      .maybeSingle();

    if (fbErr || !fb) {
      return new Response(JSON.stringify({ error: "feedback not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (fb.rating == null || fb.rating < 4) {
      return new Response(
        JSON.stringify({ error: "Google reviews are only requested for 4-5 star feedback." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: branch } = await supabase
      .from("branches")
      .select("id, name, google_review_link")
      .eq("id", fb.branch_id)
      .maybeSingle();

    if (!branch?.google_review_link) {
      return new Response(
        JSON.stringify({
          error:
            "This branch has no Google review link configured. Add it under Settings → Branches → Google Reviews.",
        }),
        { status: 412, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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

    // Resolve channel (caller override > whatsapp > sms > email)
    const channel: Channel =
      body.channel ?? (memberPhone ? "whatsapp" : memberEmail ? "email" : "in_app");

    const link = `${SUPABASE_URL}/functions/v1/google-review-redirect?f=${fb.id}`;
    const message = `Hi ${memberName ?? "there"}, thanks for the ${fb.rating}★ feedback at ${branch.name}! If we earned it, would you mind sharing a quick Google review? It helps us a lot 🙏 ${link}`;

    let logId: string | null = null;
    let sendOk = false;

    try {
      if (channel === "whatsapp" && memberPhone) {
        const r = await supabase.functions.invoke("send-whatsapp", {
          body: { to: memberPhone, message, branch_id: branch.id, context: "google_review_request", feedback_id: fb.id },
        });
        sendOk = !r.error;
        logId = (r.data as any)?.log_id ?? null;
      } else if (channel === "sms" && memberPhone) {
        const r = await supabase.functions.invoke("send-sms", {
          body: { to: memberPhone, message, branch_id: branch.id, context: "google_review_request", feedback_id: fb.id },
        });
        sendOk = !r.error;
        logId = (r.data as any)?.log_id ?? null;
      } else if (channel === "email" && memberEmail) {
        const r = await supabase.functions.invoke("send-email", {
          body: {
            to: memberEmail,
            subject: `Quick favor — share your experience at ${branch.name}?`,
            html: `<p>Hi ${memberName ?? "there"},</p><p>Thanks for the ${fb.rating}★ feedback at ${branch.name}. If we earned it, please share a quick Google review:</p><p><a href="${link}">Leave a Google review</a></p>`,
            branch_id: branch.id,
            context: "google_review_request",
            feedback_id: fb.id,
          },
        });
        sendOk = !r.error;
        logId = (r.data as any)?.log_id ?? null;
      } else {
        // in_app fallback — nothing sent, just mark queued
        sendOk = false;
      }
    } catch (e) {
      console.error("send dispatch failed", e);
      sendOk = false;
    }

    const status = sendOk ? "sent" : "failed";
    await supabase
      .from("feedback")
      .update({
        google_review_request_status: status,
        google_review_request_channel: channel,
        google_review_requested_at: new Date().toISOString(),
        google_review_request_message_id: logId,
      })
      .eq("id", fb.id);

    return new Response(JSON.stringify({ ok: sendOk, status, channel, link }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("request-google-review error", err);
    const msg = err instanceof Error ? err.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
