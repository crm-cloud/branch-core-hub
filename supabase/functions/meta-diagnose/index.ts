// v1.0.0 — Diagnose Meta/Instagram integration health end-to-end
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  META_API_BASE,
  IG_API_BASE,
  detectMetaHost,
  metaFetchWithFallback,
} from "../_shared/meta-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Check = { id: string; label: string; ok: boolean; detail: string };

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const integrationId: string | undefined = body.integration_id;
    if (!integrationId) {
      return json({ error: "integration_id required" }, 400);
    }

    const { data: integ, error } = await supabase
      .from("integration_settings")
      .select("id, integration_type, config, credentials, is_active, branch_id")
      .eq("id", integrationId)
      .maybeSingle();
    if (error || !integ) return json({ error: "Integration not found" }, 404);

    const checks: Check[] = [];
    const cfg: any = integ.config || {};
    const creds: any = integ.credentials || {};
    const token: string = creds.access_token || creds.page_access_token || "";
    const appSecret: string = creds.app_secret || "";
    const verifyToken: string = cfg.webhook_verify_token || "";

    // 1. Verify token saved
    checks.push({
      id: "verify_token",
      label: "Webhook verify token saved",
      ok: !!verifyToken,
      detail: verifyToken
        ? `Configured (${verifyToken.slice(0, 8)}…). Paste this same value in Meta → ${integ.integration_type === "instagram_login" ? "Instagram product → Configure webhooks" : "Webhooks panel"}.`
        : "MISSING — generate a verify token and paste it in Meta Dashboard webhooks panel.",
    });

    // 2. Token format / host detection
    const { base, isInstagramLogin } = detectMetaHost(token);
    checks.push({
      id: "token_format",
      label: "Access token format",
      ok: !!token,
      detail: !token
        ? "MISSING — paste an access token."
        : `Detected ${isInstagramLogin ? "Instagram Login (IGAA…) — graph.instagram.com" : "Facebook/Page (EAA…) — graph.facebook.com"}`,
    });

    // 3. App secret format
    const secretShape = /^[a-f0-9]{32}$/i.test(appSecret);
    const expectedSecret = isInstagramLogin
      ? "Instagram App Secret (Meta → Instagram product → API setup with Instagram login)"
      : "Basic App Secret (Meta → Settings → Basic)";
    checks.push({
      id: "app_secret",
      label: "App Secret",
      ok: !!appSecret && secretShape,
      detail: !appSecret
        ? `MISSING — webhook signature verification will fail. Use the ${expectedSecret}.`
        : !secretShape
        ? `Format looks wrong (expected 32 hex chars). Make sure you pasted the ${expectedSecret}.`
        : `Saved (prefix ${appSecret.slice(0, 6)}…). Must be the ${expectedSecret}.`,
    });

    // 4. Token validity → /me
    if (token) {
      try {
        const meUrl = isInstagramLogin
          ? `${IG_API_BASE}/me?fields=id,username,account_type&access_token=${encodeURIComponent(token)}`
          : `${META_API_BASE}/me?fields=id,name&access_token=${encodeURIComponent(token)}`;
        const r = await metaFetchWithFallback(meUrl);
        const j = await r.json();
        if (r.ok && j.id) {
          checks.push({
            id: "token_validity",
            label: "Token is valid",
            ok: true,
            detail: `Authenticated as ${j.username || j.name || j.id} (${j.account_type || "page"})`,
          });
        } else {
          checks.push({
            id: "token_validity",
            label: "Token is valid",
            ok: false,
            detail: `Meta rejected the token: ${j?.error?.message || r.statusText}`,
          });
        }
      } catch (e) {
        checks.push({
          id: "token_validity",
          label: "Token is valid",
          ok: false,
          detail: `Network error calling Meta: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }

    // 5. Subscribed apps on the IG account
    const igAccountId = cfg.instagram_account_id || cfg.page_id;
    if (token && igAccountId) {
      try {
        const subUrl = isInstagramLogin
          ? `${IG_API_BASE}/${igAccountId}/subscribed_apps?access_token=${encodeURIComponent(token)}`
          : `${META_API_BASE}/${igAccountId}/subscribed_apps?access_token=${encodeURIComponent(token)}`;
        const r = await metaFetchWithFallback(subUrl);
        const j = await r.json();
        const apps = Array.isArray(j?.data) ? j.data : [];
        const fields: string[] = apps[0]?.subscribed_fields || [];
        const required = ["messages", "messaging_postbacks", "comments", "mentions"];
        const missing = required.filter((f) => !fields.includes(f));
        checks.push({
          id: "subscribed_apps",
          label: "App subscribed to webhook fields",
          ok: apps.length > 0 && missing.length === 0,
          detail:
            apps.length === 0
              ? "App is NOT subscribed to this account. Click 'Subscribe Page & IG to Webhook Events' first."
              : missing.length === 0
              ? `Subscribed to: ${fields.join(", ")}`
              : `Subscribed but missing fields: ${missing.join(", ")}. Re-subscribe and ensure those fields are checked in Meta → Instagram → Webhooks.`,
        });
      } catch (e) {
        checks.push({
          id: "subscribed_apps",
          label: "App subscribed to webhook fields",
          ok: false,
          detail: `Could not fetch subscribed apps: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }

    // 6. Recent webhook deliveries (any received in last 24h?)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: msgCount } = await supabase
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("platform", "instagram")
      .gte("created_at", since);
    const { count: failCount } = await supabase
      .from("webhook_failures")
      .select("id", { count: "exact", head: true })
      .eq("source", "meta-webhook")
      .gte("created_at", since);
    const { data: recentIngress } = await supabase
      .from("webhook_ingress_log")
      .select("object_type, fields, messaging_count, signature_verified, sample, created_at")
      .eq("source", "meta-webhook")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);
    const { data: recentProcessing } = await supabase
      .from("webhook_processing_log")
      .select("event_kind, status, reason, meta_error_message, platform_message_id, created_at")
      .eq("source", "meta-webhook")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);

    const ingressCount = recentIngress?.length || 0;
    const droppedCount = (recentProcessing || []).filter(
      (r: any) => r.status === "dropped" || r.status === "resolve_failed"
    ).length;
    const placeholderCount = (recentProcessing || []).filter((r: any) => r.status === "placeholder_stored").length;
    const storedCount = (recentProcessing || []).filter((r: any) => r.status === "stored").length;

    checks.push({
      id: "recent_traffic",
      label: "Webhook traffic in the last 24h",
      ok: (msgCount || 0) > 0 && droppedCount === 0,
      detail:
        (msgCount || 0) > 0 && droppedCount === 0
          ? `${msgCount} Instagram message(s) stored. ${ingressCount} webhook delivery(ies). ${failCount || 0} signature failure(s).`
          : (failCount || 0) > 0
          ? `0 messages but ${failCount} failures recorded — likely WRONG APP SECRET. Use the ${expectedSecret}.`
          : ingressCount > 0
          ? `Meta IS delivering (${ingressCount} payload(s) accepted). But processing summary: stored=${storedCount}, placeholder=${placeholderCount}, dropped=${droppedCount}. Check 'meta_error_message' in webhook_processing_log for the exact reason.`
          : "0 messages and 0 deliveries — Meta has not delivered ANY webhook. Most common cause: your personal IG account is not added as an Instagram Tester in Meta App Roles (required while app is in Dev mode), or 'Include Values' is OFF in the webhook subscription configuration.",
    });

    if (recentIngress && recentIngress.length > 0) {
      const last = recentIngress[0] as any;
      const lastEvent = last?.sample?.messaging?.[0] || last?.sample?.changes?.[0] || null;
      const eventKind = lastEvent?.message ? "message" :
                        lastEvent?.message_edit ? "message_edit (no text)" :
                        lastEvent?.field ? `changes:${lastEvent.field}` :
                        "unknown";
      checks.push({
        id: "last_payload_shape",
        label: "Most recent Meta payload shape",
        ok: true,
        detail: `${eventKind} at ${last.created_at} (signature_verified=${last.signature_verified}). Fields=${(last.fields || []).join(",") || "-"}, messaging_count=${last.messaging_count}.`,
      });
    }

    if (recentProcessing && recentProcessing.length > 0) {
      const last = recentProcessing[0] as any;
      checks.push({
        id: "last_processing_result",
        label: "Most recent processing result",
        ok: last.status === "stored" || last.status === "deduped",
        detail: `${last.event_kind} → ${last.status}${last.reason ? " (" + last.reason + ")" : ""}${last.meta_error_message ? " · Meta: " + last.meta_error_message : ""} at ${last.created_at}`,
      });
    }

    const allOk = checks.every((c) => c.ok);
    return json({ ok: allOk, checks });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
