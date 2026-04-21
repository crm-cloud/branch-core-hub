// v2.0.0 — Unified Send Message: WhatsApp, Instagram DM, Facebook Messenger
// E2: IG sends via Page endpoint primary, IG-account fallback, surface Meta error codes
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const serve = Deno.serve;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_VERSION = "v23.0";

async function generateAppSecretProof(accessToken: string, appSecret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(accessToken));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function buildMessagePayload(
  recipientId: string,
  content: string | undefined,
  message_type: string,
  media_url: string | null | undefined,
  isInstagramProduct: boolean,
) {
  const payload: any = {
    recipient: { id: recipientId },
    messaging_type: "RESPONSE",
  };
  if (isInstagramProduct) payload.messaging_product = "instagram";

  if ((message_type === "image" || message_type === "video" || message_type === "audio" || message_type === "file") && media_url) {
    const attachType = message_type === "file" ? "file" : message_type;
    payload.message = {
      attachment: { type: attachType, payload: { url: media_url, is_reusable: true } },
    };
  } else {
    payload.message = { text: content || "" };
  }
  return payload;
}

async function postToMeta(url: string, accessToken: string, appsecretProof: string, body: any) {
  const finalUrl = appsecretProof
    ? `${url}${url.includes("?") ? "&" : "?"}appsecret_proof=${appsecretProof}`
    : url;
  const resp = await fetch(finalUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      message_id,
      recipient_id,
      content,
      branch_id,
      platform = "whatsapp",
      message_type = "text",
      media_url,
      caption,
      phone_number,
    } = body;

    const recipientId = recipient_id || phone_number;
    if (!message_id || !recipientId || !branch_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: message_id, recipient_id/phone_number, branch_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (platform === "whatsapp") {
      const waResponse = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
        body: JSON.stringify({ message_id, phone_number: recipientId, content, branch_id, message_type, media_url, caption }),
      });
      const waData = await waResponse.json();
      return new Response(JSON.stringify(waData), {
        status: waResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Instagram or Messenger — use Meta Graph API
    const integrationType = platform === "instagram" ? "instagram" : "messenger";

    const { data: branchInteg } = await supabase
      .from("integration_settings")
      .select("config, credentials, is_active")
      .eq("branch_id", branch_id)
      .eq("integration_type", integrationType)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    let integration: any = branchInteg;
    if (!integration) {
      const { data: globalInteg } = await supabase
        .from("integration_settings")
        .select("config, credentials, is_active")
        .is("branch_id", null)
        .eq("integration_type", integrationType)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      integration = globalInteg;
    }

    if (!integration) {
      await supabase.from("whatsapp_messages").update({ status: "failed" }).eq("id", message_id);
      return new Response(
        JSON.stringify({ error: `${platform} integration not configured or inactive` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = integration.credentials?.access_token || integration.credentials?.page_access_token;
    if (!accessToken) {
      await supabase.from("whatsapp_messages").update({ status: "failed" }).eq("id", message_id);
      return new Response(
        JSON.stringify({ error: `Missing access_token in ${platform} configuration` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appSecret = integration.credentials?.app_secret;
    const appsecretProof = appSecret ? await generateAppSecretProof(accessToken, appSecret) : "";

    const pageId = integration.config?.page_id;
    const igAccountId = integration.config?.instagram_account_id;

    // Build send strategy: try Page endpoint first when available, then IG-account fallback
    type Attempt = { url: string; igProduct: boolean; label: string };
    const attempts: Attempt[] = [];

    if (platform === "instagram") {
      if (pageId) attempts.push({ url: `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/messages`, igProduct: false, label: "page" });
      if (igAccountId) attempts.push({ url: `https://graph.facebook.com/${GRAPH_VERSION}/${igAccountId}/messages`, igProduct: true, label: "ig-account" });
    } else {
      // Messenger
      if (!pageId) {
        await supabase.from("whatsapp_messages").update({ status: "failed" }).eq("id", message_id);
        return new Response(
          JSON.stringify({ error: "Missing page_id in messenger configuration" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      attempts.push({ url: `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/messages`, igProduct: false, label: "page" });
    }

    if (attempts.length === 0) {
      await supabase.from("whatsapp_messages").update({ status: "failed" }).eq("id", message_id);
      return new Response(
        JSON.stringify({ error: `Missing page_id or instagram_account_id in ${platform} configuration` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let lastError: any = null;
    let lastStatus = 502;
    let success: { data: any; label: string } | null = null;

    for (const attempt of attempts) {
      const payload = buildMessagePayload(recipientId, content || caption, message_type, media_url, attempt.igProduct);
      console.log(`[send-message:${platform}] attempt=${attempt.label} url=${attempt.url}`);
      const result = await postToMeta(attempt.url, accessToken, appsecretProof, payload);
      if (result.ok && !result.data?.error) {
        success = { data: result.data, label: attempt.label };
        break;
      }
      lastError = result.data?.error || result.data;
      lastStatus = result.status || 502;
      const code = lastError?.code;
      const subcode = lastError?.error_subcode;
      console.error(`[send-message:${platform}] attempt=${attempt.label} failed code=${code} sub=${subcode} msg=${lastError?.message}`);
      // If the error is about messaging_product or endpoint mismatch, try next attempt; otherwise stop
      const msg = String(lastError?.message || "").toLowerCase();
      const retryable = msg.includes("messaging_product") || msg.includes("does not exist") || msg.includes("unsupported") || msg.includes("not a valid");
      if (!retryable && attempts.length > 1) {
        // continue to fallback anyway — the next endpoint may succeed
      }
    }

    if (!success) {
      await supabase
        .from("whatsapp_messages")
        .update({
          status: "failed",
          content: `${content || caption || ""}\n\n[Meta error ${lastError?.code || ""}/${lastError?.error_subcode || ""}: ${lastError?.message || "unknown"}]`,
        })
        .eq("id", message_id);
      return new Response(
        JSON.stringify({
          error: `Failed to send ${platform} message`,
          meta_error_code: lastError?.code,
          meta_error_subcode: lastError?.error_subcode,
          meta_error_message: lastError?.message,
        }),
        { status: lastStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const platformMsgId = success.data?.message_id || success.data?.messages?.[0]?.id || null;

    await supabase
      .from("whatsapp_messages")
      .update({ status: "sent", platform_message_id: platformMsgId })
      .eq("id", message_id);

    await supabase.from("communication_logs").insert({
      branch_id,
      recipient: recipientId,
      type: platform,
      content: content || `[${message_type}]`,
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    console.log(`[send-message:${platform}] success via=${success.label} mid=${platformMsgId}`);
    return new Response(
      JSON.stringify({ success: true, platform_message_id: platformMsgId, route: success.label }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[send-message] error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
