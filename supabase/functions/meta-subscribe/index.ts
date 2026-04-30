// v1.0.0 — Subscribe connected Page + IG account to Meta webhook events.
// POST { branch_id?, integration_type: "instagram"|"instagram_login"|"messenger" }
// Calls /{page-id}/subscribed_apps and (for IG) /{ig-user-id}/subscribed_apps
// so Meta actually delivers webhook events to our meta-webhook endpoint.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { META_API_BASE, IG_API_BASE, detectMetaHost } from "../_shared/meta-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAGE_FIELDS = [
  "messages", "messaging_postbacks", "messaging_optins",
  "message_deliveries", "message_reads", "messaging_referrals",
];
const IG_FIELDS = [
  "messages", "messaging_postbacks", "messaging_seen",
  "comments", "mentions", "story_insights", "messaging_referral",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { branch_id = null, integration_type = "instagram" } = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve integration: prefer instagram_login when integration_type=instagram
    const candidates = integration_type === "instagram"
      ? ["instagram_login", "instagram"]
      : [integration_type];

    let integration: any = null;
    for (const it of candidates) {
      let q = supabase
        .from("integration_settings")
        .select("id, integration_type, config, credentials, branch_id")
        .eq("integration_type", it)
        .eq("is_active", true)
        .limit(1);
      q = branch_id ? q.eq("branch_id", branch_id) : q.is("branch_id", null);
      const { data } = await q.maybeSingle();
      if (data) { integration = data; break; }
    }

    if (!integration) {
      return new Response(JSON.stringify({ error: `No active ${integration_type} integration found` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = integration.credentials?.access_token || integration.credentials?.page_access_token;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Missing access_token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pageId = integration.config?.page_id;
    const igId = integration.config?.instagram_account_id;
    const { isInstagramLogin } = detectMetaHost(accessToken);

    const results: any[] = [];

    // Subscribe IG account (Instagram Login API)
    if (isInstagramLogin && igId) {
      const url = `${IG_API_BASE}/${igId}/subscribed_apps?subscribed_fields=${IG_FIELDS.join(",")}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const d = await r.json().catch(() => ({}));
      results.push({ target: "instagram_login", id: igId, status: r.status, ok: r.ok, data: d });
    }

    // Subscribe Page (works for both Messenger and IG-via-Page)
    if (!isInstagramLogin && pageId) {
      const url = `${META_API_BASE}/${pageId}/subscribed_apps?subscribed_fields=${PAGE_FIELDS.join(",")}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const d = await r.json().catch(() => ({}));
      results.push({ target: "page", id: pageId, status: r.status, ok: r.ok, data: d });

      // Also subscribe IG account via FB Graph (IG-via-Page flow)
      if (igId) {
        const url2 = `${META_API_BASE}/${igId}/subscribed_apps?subscribed_fields=${IG_FIELDS.join(",")}`;
        const r2 = await fetch(url2, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const d2 = await r2.json().catch(() => ({}));
        results.push({ target: "instagram_via_page", id: igId, status: r2.status, ok: r2.ok, data: d2 });
      }
    }

    // Verify by reading current subscriptions
    const verifyId = isInstagramLogin ? igId : pageId;
    const verifyBase = isInstagramLogin ? IG_API_BASE : META_API_BASE;
    let currentSubs: any = null;
    if (verifyId) {
      const vr = await fetch(`${verifyBase}/${verifyId}/subscribed_apps`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      currentSubs = await vr.json().catch(() => ({}));
    }

    const allOk = results.every(r => r.ok && !r.data?.error);
    return new Response(JSON.stringify({
      success: allOk,
      integration_type: integration.integration_type,
      page_id: pageId, instagram_account_id: igId,
      results,
      current_subscriptions: currentSubs,
      hint: allOk
        ? "Subscribed. Send a fresh DM to test — it should appear in Live Feed within seconds."
        : "Subscription failed. Check token scopes (instagram_business_manage_messages, pages_messaging) and that the IG account is a Business account.",
    }), { status: allOk ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
