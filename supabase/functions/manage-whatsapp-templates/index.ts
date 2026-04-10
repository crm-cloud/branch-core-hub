// v2.0.0 — appsecret_proof support + error logging
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const META_GRAPH_VERSION = "v25.0";
const META_API_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

async function computeAppSecretProof(accessToken: string, appSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(accessToken));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function appendProof(url: string, proof: string | null): string {
  if (!proof) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}appsecret_proof=${proof}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller identity via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, branch_id, template_id, template_data } = body;

    if (!action || !branch_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: action, branch_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(branch_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid branch_id format — must be a UUID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify role access
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin", "manager"])
      .limit(1);

    const hasAllowedRole = Array.isArray(userRoles) && userRoles.length > 0;
    if (!hasAllowedRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden — only owners, admins, and managers can manage Meta templates" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch WhatsApp integration settings
    let activeIntegration: any = null;
    const { data: branchIntegration } = await supabase
      .from("integration_settings")
      .select("config, credentials, is_active")
      .eq("branch_id", branch_id)
      .eq("integration_type", "whatsapp")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (branchIntegration) {
      activeIntegration = branchIntegration;
    } else {
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
    const appSecret = activeIntegration.credentials?.app_secret || null;

    if (!accessToken || !wabaId) {
      return new Response(
        JSON.stringify({ error: "Missing access_token or business_account_id in WhatsApp configuration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Compute appsecret_proof if app_secret is configured
    let proof: string | null = null;
    if (appSecret) {
      proof = await computeAppSecretProof(accessToken, appSecret);
    }

    // ── ACTION: list ──
    if (action === "list") {
      const listUrl = appendProof(
        `${META_API_BASE}/${wabaId}/message_templates?fields=id,name,status,category,language,rejected_reason,quality_score,components&limit=100`,
        proof
      );

      let metaRes: Response;
      let metaData: any;
      try {
        metaRes = await fetch(listUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        metaData = await metaRes.json();
      } catch (fetchErr) {
        const errMsg = fetchErr instanceof Error ? fetchErr.message : "Network error";
        await logError(supabase, branch_id, "manage-whatsapp-templates", "Meta API fetch error", errMsg);
        return new Response(
          JSON.stringify({ error: "Failed to reach Meta API", details: errMsg }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!metaRes.ok) {
        const errMsg = metaData?.error?.message || "Failed to list templates from Meta";
        console.error("Meta list templates error:", JSON.stringify(metaData));
        await logError(supabase, branch_id, "manage-whatsapp-templates", `Meta API ${metaRes.status}`, errMsg);
        return new Response(
          JSON.stringify({ error: errMsg }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const templates = metaData.data || [];

      // Upsert into whatsapp_templates table
      for (const mt of templates) {
        await supabase
          .from("whatsapp_templates")
          .upsert(
            {
              waba_id: wabaId,
              branch_id: branch_id,
              meta_template_id: mt.id,
              name: mt.name,
              language: mt.language || "en",
              category: mt.category,
              status: mt.status,
              quality_score: mt.quality_score?.score || mt.quality_score || null,
              rejected_reason: mt.rejected_reason || null,
              components: mt.components || null,
              synced_at: new Date().toISOString(),
            },
            { onConflict: "waba_id,name,language" }
          );
      }

      // Also update legacy templates table
      for (const mt of templates) {
        await supabase
          .from("templates")
          .update({
            meta_template_status: mt.status,
            meta_rejection_reason: mt.rejected_reason || null,
          })
          .eq("meta_template_name", mt.name)
          .not("meta_template_name", "is", null)
          .or(`branch_id.eq.${branch_id},branch_id.is.null`);
      }

      return new Response(
        JSON.stringify({ templates }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ACTION: create ──
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

      const safeName = name.toLowerCase().replace(/[\s\-]+/g, "_").replace(/[^a-z0-9_]/g, "");

      const metaPayload = {
        name: safeName,
        category,
        language,
        components: [{ type: "BODY", text: body_text }],
      };

      const createUrl = appendProof(`${META_API_BASE}/${wabaId}/message_templates`, proof);

      let metaRes: Response;
      let metaData: any;
      try {
        metaRes = await fetch(createUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metaPayload),
        });
        metaData = await metaRes.json();
      } catch (fetchErr) {
        const errMsg = fetchErr instanceof Error ? fetchErr.message : "Network error";
        await logError(supabase, branch_id, "manage-whatsapp-templates", "Meta API create fetch error", errMsg);
        return new Response(
          JSON.stringify({ error: "Failed to reach Meta API", details: errMsg }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!metaRes.ok) {
        const errMsg = metaData?.error?.message || "Failed to create template in Meta";
        console.error("Meta create template error:", JSON.stringify(metaData));
        await logError(supabase, branch_id, "manage-whatsapp-templates", `Meta API create ${metaRes.status}`, errMsg);
        return new Response(
          JSON.stringify({ error: errMsg }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (local_template_id) {
        const { data: targetTemplate } = await supabase
          .from("templates")
          .select("id, branch_id")
          .eq("id", local_template_id)
          .maybeSingle();

        if (targetTemplate) {
          if (targetTemplate.branch_id !== null && targetTemplate.branch_id !== branch_id) {
            return new Response(
              JSON.stringify({ error: "Forbidden — template does not belong to the requested branch" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          await supabase
            .from("templates")
            .update({
              meta_template_name: safeName,
              meta_template_status: metaData.status || "PENDING",
              meta_rejection_reason: null,
            })
            .eq("id", local_template_id);
        }
      }

      return new Response(
        JSON.stringify({ success: true, meta_template_id: metaData.id, status: metaData.status, name: safeName }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ACTION: get_status ──
    if (action === "get_status") {
      if (!template_id) {
        return new Response(
          JSON.stringify({ error: "Missing template_id for get_status action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const statusUrl = appendProof(
        `${META_API_BASE}/${template_id}?fields=id,name,status,rejected_reason,category`,
        proof
      );

      let metaRes: Response;
      let metaData: any;
      try {
        metaRes = await fetch(statusUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        metaData = await metaRes.json();
      } catch (fetchErr) {
        const errMsg = fetchErr instanceof Error ? fetchErr.message : "Network error";
        await logError(supabase, branch_id, "manage-whatsapp-templates", "Meta API status fetch error", errMsg);
        return new Response(
          JSON.stringify({ error: "Failed to reach Meta API", details: errMsg }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!metaRes.ok) {
        const errMsg = metaData?.error?.message || "Failed to get template status from Meta";
        console.error("Meta get_status error:", JSON.stringify(metaData));
        await logError(supabase, branch_id, "manage-whatsapp-templates", `Meta API status ${metaRes.status}`, errMsg);
        return new Response(
          JSON.stringify({ error: errMsg }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("templates")
        .update({
          meta_template_status: metaData.status,
          meta_rejection_reason: metaData.rejected_reason || null,
        })
        .eq("meta_template_name", metaData.name)
        .not("meta_template_name", "is", null)
        .or(`branch_id.eq.${branch_id},branch_id.is.null`);

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

async function logError(supabase: any, branchId: string, component: string, title: string, details: string) {
  try {
    await supabase.from("error_logs").insert({
      source: "edge_function",
      component_name: component,
      error_message: `${title}: ${details}`,
      branch_id: branchId,
    });
  } catch (e) {
    console.error("Failed to log error:", e);
  }
}
