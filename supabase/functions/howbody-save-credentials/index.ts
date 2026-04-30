// v1.0.0 — Save / read HOWBODY body-scanner credentials (admin only)
// GET  → returns { configured, source, base_url, username, app_key_masked }
// POST → upserts { base_url, username, app_key } into integration_settings
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, admin } from "../_shared/howbody.ts";

interface SavePayload {
  base_url?: string;
  username?: string;
  app_key?: string;
  is_active?: boolean;
}

function mask(v: string | null | undefined) {
  if (!v) return "";
  if (v.length <= 8) return "•".repeat(v.length);
  return `${v.slice(0, 4)}${"•".repeat(Math.max(4, v.length - 8))}${v.slice(-4)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "Unauthorized" }, 401);

    const sbAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await sbAuth.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (!userId) return json({ ok: false, error: "Unauthorized" }, 401);

    const sb = admin();

    // Role check — owner/admin only
    const { data: roleRows } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows || []).map((r: any) => r.role);
    if (!roles.some((r) => r === "owner" || r === "admin")) {
      return json({ ok: false, error: "Forbidden — admin only" }, 403);
    }

    // Read current row (may be null)
    const { data: existing } = await sb
      .from("integration_settings")
      .select("id, config, credentials, is_active")
      .eq("integration_type", "body_scanner")
      .eq("provider", "howbody")
      .is("branch_id", null)
      .maybeSingle();

    if (req.method === "GET") {
      const cfg = (existing?.config || {}) as Record<string, string>;
      const creds = (existing?.credentials || {}) as Record<string, string>;
      const dbConfigured = !!(cfg.base_url && cfg.username && creds.app_key);
      const envConfigured = !!(
        Deno.env.get("HOWBODY_BASE_URL") &&
        Deno.env.get("HOWBODY_USERNAME") &&
        Deno.env.get("HOWBODY_APPKEY")
      );
      return json({
        ok: true,
        configured: dbConfigured || envConfigured,
        source: dbConfigured ? "db" : envConfigured ? "env" : "none",
        is_active: existing?.is_active ?? true,
        base_url: cfg.base_url || (dbConfigured ? "" : Deno.env.get("HOWBODY_BASE_URL") || ""),
        username: cfg.username || (dbConfigured ? "" : Deno.env.get("HOWBODY_USERNAME") || ""),
        app_key_masked: mask(creds.app_key || (dbConfigured ? "" : Deno.env.get("HOWBODY_APPKEY") || "")),
        has_app_key: !!creds.app_key,
      });
    }

    if (req.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405);
    }

    const body = (await req.json().catch(() => ({}))) as SavePayload;
    const baseUrl = (body.base_url || "").trim().replace(/\/+$/, "");
    const username = (body.username || "").trim();
    const appKey = (body.app_key || "").trim();
    const isActive = body.is_active ?? true;

    if (!baseUrl || !username) {
      return json({ ok: false, error: "Base URL and Username are required" }, 400);
    }

    // Preserve existing app_key if user left it blank (means "unchanged")
    const existingCreds = (existing?.credentials || {}) as Record<string, string>;
    const finalAppKey = appKey || existingCreds.app_key || "";
    if (!finalAppKey) {
      return json({ ok: false, error: "App Key is required for first-time setup" }, 400);
    }

    const newConfig = { base_url: baseUrl, username };
    const newCreds = { ...existingCreds, app_key: finalAppKey };

    if (existing?.id) {
      const { error } = await sb
        .from("integration_settings")
        .update({
          config: newConfig,
          credentials: newCreds,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) return json({ ok: false, error: error.message }, 500);
    } else {
      const { error } = await sb
        .from("integration_settings")
        .insert({
          branch_id: null,
          integration_type: "body_scanner",
          provider: "howbody",
          is_active: isActive,
          config: newConfig,
          credentials: newCreds,
        });
      if (error) return json({ ok: false, error: error.message }, 500);
    }

    // Invalidate cached token so next call uses fresh creds
    await sb.from("howbody_tokens").delete().neq("token", "");

    return json({ ok: true });
  } catch (e) {
    console.error("howbody-save-credentials error:", e);
    return json({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
