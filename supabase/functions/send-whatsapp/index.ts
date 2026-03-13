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
    const { message_id, phone_number, content, branch_id } = await req.json();

    if (!message_id || !phone_number || !content || !branch_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: message_id, phone_number, content, branch_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch WhatsApp integration settings for the branch
    const { data: integration, error: intError } = await supabase
      .from("integration_settings")
      .select("config, credentials, is_active")
      .eq("branch_id", branch_id)
      .eq("integration_type", "whatsapp")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (intError || !integration) {
      // Update message status to failed
      await supabase
        .from("whatsapp_messages")
        .update({ status: "failed" })
        .eq("id", message_id);

      return new Response(
        JSON.stringify({ error: "WhatsApp integration not configured or inactive for this branch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = integration.credentials?.access_token;
    const phoneNumberId = integration.config?.phone_number_id;

    if (!accessToken || !phoneNumberId) {
      await supabase
        .from("whatsapp_messages")
        .update({ status: "failed" })
        .eq("id", message_id);

      return new Response(
        JSON.stringify({ error: "Missing access_token or phone_number_id in WhatsApp configuration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number (remove spaces, dashes, ensure no leading +)
    const cleanPhone = phone_number.replace(/[\s\-\+]/g, "");

    // Send via Meta Cloud API
    const metaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "text",
          text: { body: content },
        }),
      }
    );

    const metaData = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error("Meta API error:", JSON.stringify(metaData));
      await supabase
        .from("whatsapp_messages")
        .update({ status: "failed" })
        .eq("id", message_id);

      return new Response(
        JSON.stringify({ 
          error: "Failed to send WhatsApp message", 
          meta_error: metaData?.error?.message || "Unknown Meta API error" 
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update message status to sent
    await supabase
      .from("whatsapp_messages")
      .update({ 
        status: "sent",
        external_id: metaData?.messages?.[0]?.id || null,
      })
      .eq("id", message_id);

    // Log communication
    await supabase.from("communication_logs").insert({
      branch_id,
      recipient: phone_number,
      type: "whatsapp",
      content,
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ success: true, whatsapp_message_id: metaData?.messages?.[0]?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("send-whatsapp error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
