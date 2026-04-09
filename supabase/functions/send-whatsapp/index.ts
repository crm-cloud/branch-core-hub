import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const message_id = body.message_id ?? body.messageId;
    const phone_number = body.phone_number ?? body.phone;
    const content = body.content ?? body.message;
    const branch_id = body.branch_id ?? body.branchId;
    const message_type = body.message_type || "text";
    const media_url = body.media_url;
    const caption = body.caption;
    const template_name = body.template_name;
    const template_language = body.template_language || "en";
    const template_components = body.template_components;

    if (!message_id || !phone_number || !branch_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: message_id, phone_number, branch_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // For text messages, content is required
    if (message_type === "text" && !content) {
      return new Response(
        JSON.stringify({ error: "Missing required field: content (for text messages)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // For template messages, template_name is required
    if (message_type === "template" && !template_name) {
      return new Response(
        JSON.stringify({ error: "Missing required field: template_name (for template messages)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch WhatsApp integration settings for the branch, then fall back to global.
    let integration: any = null;
    const { data: branchIntegration, error: intError } = await supabase
      .from("integration_settings")
      .select("config, credentials, is_active")
      .eq("branch_id", branch_id)
      .eq("integration_type", "whatsapp")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (intError) {
      await supabase.from("whatsapp_messages").update({ status: "failed" }).eq("id", message_id);
      return new Response(JSON.stringify({ error: "Failed to load WhatsApp integration settings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (branchIntegration) {
      integration = branchIntegration;
    } else {
      const { data: globalIntegration } = await supabase
        .from("integration_settings")
        .select("config, credentials, is_active")
        .is("branch_id", null)
        .eq("integration_type", "whatsapp")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      integration = globalIntegration;
    }

    if (!integration) {
      await supabase.from("whatsapp_messages").update({ status: "failed" }).eq("id", message_id);
      return new Response(
        JSON.stringify({ error: "WhatsApp integration not configured or inactive for this branch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = integration.credentials?.access_token;
    const phoneNumberId = integration.config?.phone_number_id;

    if (!accessToken || !phoneNumberId) {
      await supabase.from("whatsapp_messages").update({ status: "failed" }).eq("id", message_id);
      return new Response(
        JSON.stringify({ error: "Missing access_token or phone_number_id in WhatsApp configuration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Clean phone number
    const cleanPhone = phone_number.replace(/[\s\-\+]/g, "");

    // Build Meta payload based on message type
    let metaPayload: any = {
      messaging_product: "whatsapp",
      to: cleanPhone,
    };

    if (message_type === "image") {
      metaPayload.type = "image";
      metaPayload.image = {
        link: media_url,
        ...(caption ? { caption } : {}),
      };
    } else if (message_type === "template") {
      metaPayload.type = "template";
      metaPayload.template = {
        name: template_name,
        language: { code: template_language },
        ...(template_components ? { components: template_components } : {}),
      };
    } else {
      // Default: text
      metaPayload.type = "text";
      metaPayload.text = { body: content };
    }

    // Send via Meta Cloud API
    const metaResponse = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metaPayload),
    });

    const metaData = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error("Meta API error:", JSON.stringify(metaData));
      await supabase.from("whatsapp_messages").update({ status: "failed" }).eq("id", message_id);
      return new Response(
        JSON.stringify({
          error: "Failed to send WhatsApp message",
          meta_error: metaData?.error?.message || "Unknown Meta API error",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const waMessageId = metaData?.messages?.[0]?.id || null;

    // Update message status to sent + store Meta's message ID
    await supabase
      .from("whatsapp_messages")
      .update({
        status: "sent",
        whatsapp_message_id: waMessageId,
      })
      .eq("id", message_id);

    // Log communication
    await supabase.from("communication_logs").insert({
      branch_id,
      recipient: phone_number,
      type: "whatsapp",
      content: content || `[${message_type}]`,
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true, whatsapp_message_id: waMessageId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("send-whatsapp error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
