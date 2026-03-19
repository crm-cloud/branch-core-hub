import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const META_GRAPH_VERSION = "v18.0";
const META_API_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, branch_id, template_id, template_data } = body;

    if (!action || !branch_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: action, branch_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch WhatsApp integration settings for the branch
    const { data: integration, error: intError } = await supabase
      .from("integration_settings")
      .select("config, credentials, is_active")
      .eq("branch_id", branch_id)
      .eq("integration_type", "whatsapp")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    // If no branch-specific integration, try global (null branch_id)
    let activeIntegration = integration;
    if (intError || !integration) {
      const { data: globalIntegration } = await supabase
        .from("integration_settings")
        .select("config, credentials, is_active")
        .is("branch_id", null)
        .eq("integration_type", "whatsapp")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      activeIntegration = globalIntegration;
    }

    if (!activeIntegration) {
      return new Response(
        JSON.stringify({ error: "WhatsApp integration not configured or inactive for this branch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = activeIntegration.credentials?.access_token;
    const wabaId = activeIntegration.config?.business_account_id;

    if (!accessToken || !wabaId) {
      return new Response(
        JSON.stringify({ error: "Missing access_token or business_account_id in WhatsApp configuration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ACTION: list — GET all templates from Meta ──────────────────────────
    if (action === "list") {
      const metaRes = await fetch(
        `${META_API_BASE}/${wabaId}/message_templates?fields=id,name,status,category,language,rejected_reason,components&limit=100`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const metaData = await metaRes.json();
      if (!metaRes.ok) {
        console.error("Meta list templates error:", JSON.stringify(metaData));
        return new Response(
          JSON.stringify({ error: metaData?.error?.message || "Failed to list templates from Meta" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const templates = metaData.data || [];

      // Update local DB statuses for any matched templates
      for (const mt of templates) {
        await supabase
          .from("templates")
          .update({
            meta_template_status: mt.status,
            meta_rejection_reason: mt.rejected_reason || null,
          })
          .eq("meta_template_name", mt.name)
          .not("meta_template_name", "is", null);
      }

      return new Response(
        JSON.stringify({ templates }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ACTION: create — POST a new template to Meta ────────────────────────
    if (action === "create") {
      if (!template_data) {
        return new Response(
          JSON.stringify({ error: "Missing template_data for create action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { name, category, language, body_text, local_template_id } = template_data;

      if (!name || !category || !language || !body_text) {
        return new Response(
          JSON.stringify({ error: "Missing required template_data fields: name, category, language, body_text" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build Meta template payload
      const metaPayload = {
        name: name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
        category,
        language,
        components: [
          {
            type: "BODY",
            text: body_text,
          },
        ],
      };

      const metaRes = await fetch(
        `${META_API_BASE}/${wabaId}/message_templates`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metaPayload),
        }
      );

      const metaData = await metaRes.json();

      if (!metaRes.ok) {
        console.error("Meta create template error:", JSON.stringify(metaData));
        return new Response(
          JSON.stringify({ error: metaData?.error?.message || "Failed to create template in Meta" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update local template record with Meta status
      if (local_template_id) {
        await supabase
          .from("templates")
          .update({
            meta_template_name: metaPayload.name,
            meta_template_status: metaData.status || "PENDING",
            meta_rejection_reason: null,
          })
          .eq("id", local_template_id);
      }

      return new Response(
        JSON.stringify({ success: true, meta_template_id: metaData.id, status: metaData.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ACTION: get_status — GET a single template's current approval state ─
    if (action === "get_status") {
      if (!template_id) {
        return new Response(
          JSON.stringify({ error: "Missing template_id for get_status action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const metaRes = await fetch(
        `${META_API_BASE}/${template_id}?fields=id,name,status,rejected_reason,category`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const metaData = await metaRes.json();

      if (!metaRes.ok) {
        console.error("Meta get_status error:", JSON.stringify(metaData));
        return new Response(
          JSON.stringify({ error: metaData?.error?.message || "Failed to get template status from Meta" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update local record by matching meta_template_name
      await supabase
        .from("templates")
        .update({
          meta_template_status: metaData.status,
          meta_rejection_reason: metaData.rejected_reason || null,
        })
        .eq("meta_template_name", metaData.name)
        .not("meta_template_name", "is", null);

      return new Response(
        JSON.stringify({
          id: metaData.id,
          name: metaData.name,
          status: metaData.status,
          rejected_reason: metaData.rejected_reason || null,
          category: metaData.category,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}. Valid: list | create | get_status` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("manage-whatsapp-templates error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
