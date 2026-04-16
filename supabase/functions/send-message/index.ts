// v1.1.0 — Unified Send Message: WhatsApp, Instagram DM, Facebook Messenger
// Added: appsecret_proof for Meta Graph API calls
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Generate HMAC SHA-256 appsecret_proof for Meta Graph API */
async function generateAppSecretProof(accessToken: string, appSecret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(accessToken));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
      const waUrl = `${supabaseUrl}/functions/v1/send-whatsapp`;
      const waResponse = await fetch(waUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          message_id,
          phone_number: recipientId,
          content,
          branch_id,
          message_type,
          media_url,
          caption,
        }),
      });
      const waData = await waResponse.json();
      return new Response(JSON.stringify(waData), {
        status: waResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Instagram or Messenger — use Meta Graph API
    const integrationType = platform === "instagram" ? "instagram" : "messenger";

    let integration: any = null;
    const { data: branchInteg } = await supabase
      .from("integration_settings")
      .select("config, credentials, is_active")
      .eq("branch_id", branch_id)
      .eq("integration_type", integrationType)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (branchInteg) {
      integration = branchInteg;
    } else {
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

    // Generate appsecret_proof if app_secret is configured
    const appSecret = integration.credentials?.app_secret;
    let appsecretProof = "";
    if (appSecret) {
      appsecretProof = await generateAppSecretProof(accessToken, appSecret);
    }

    // Build Meta Graph API request
    let metaPayload: any;
    let metaUrl: string;

    if (platform === "instagram") {
      const igAccountId = integration.config?.instagram_account_id || integration.config?.page_id;
      metaUrl = `https://graph.facebook.com/v25.0/${igAccountId}/messages`;
      metaPayload = {
        recipient: { id: recipientId },
        message: message_type === "image" && media_url
          ? { attachment: { type: "image", payload: { url: media_url } } }
          : { text: content },
      };
    } else {
      const pageId = integration.config?.page_id;
      metaUrl = `https://graph.facebook.com/v25.0/${pageId}/messages`;
      metaPayload = {
        recipient: { id: recipientId },
        message: message_type === "image" && media_url
          ? { attachment: { type: "image", payload: { url: media_url, is_reusable: true } } }
          : { text: content },
        messaging_type: "RESPONSE",
      };
    }

    // Append appsecret_proof as query param
    if (appsecretProof) {
      metaUrl += `${metaUrl.includes("?") ? "&" : "?"}appsecret_proof=${appsecretProof}`;
    }

    const metaResponse = await fetch(metaUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metaPayload),
    });

    const metaData = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error(`${platform} send error:`, JSON.stringify(metaData));
      await supabase.from("whatsapp_messages").update({ status: "failed" }).eq("id", message_id);
      return new Response(
        JSON.stringify({ error: `Failed to send ${platform} message`, meta_error: metaData?.error?.message }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const platformMsgId = metaData?.message_id || metaData?.messages?.[0]?.id || null;

    await supabase
      .from("whatsapp_messages")
      .update({
        status: "sent",
        platform_message_id: platformMsgId,
      })
      .eq("id", message_id);

    await supabase.from("communication_logs").insert({
      branch_id,
      recipient: recipientId,
      type: platform,
      content: content || `[${message_type}]`,
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ success: true, platform_message_id: platformMsgId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("send-message error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
