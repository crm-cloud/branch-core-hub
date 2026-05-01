// healthz — DR/uptime probe.  v1.0.0
// Public response is intentionally minimal: { status, env, version, latency_ms }.
// Detailed component diagnostics (db / auth / storage) require either:
//   - service_role key in the Authorization header, OR
//   - an authenticated owner/admin user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const VERSION = Deno.env.get("HEALTHZ_VERSION") ?? "v1.0.0";
const ENV = Deno.env.get("HEALTHZ_ENV") ?? "primary"; // 'primary' | 'dr'

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function timed<T>(fn: () => Promise<T>) {
  const start = performance.now();
  try {
    const value = await fn();
    return { ok: true, latency_ms: Math.round(performance.now() - start), value };
  } catch (e: any) {
    return { ok: false, latency_ms: Math.round(performance.now() - start), error: String(e?.message ?? e) };
  }
}

async function isPrivilegedCaller(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return false;
  const token = auth.slice(7).trim();
  if (token === SERVICE_ROLE) return true;
  try {
    const sb = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userRes } = await sb.auth.getUser();
    if (!userRes?.user) return false;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id);
    return (roles ?? []).some((r: any) => r.role === "owner" || r.role === "admin");
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const overallStart = performance.now();
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const dbCheck = await timed(async () => {
      const { error } = await admin.from("system_health_pings").select("id").limit(1);
      if (error) throw error;
      return true;
    });

    const status = dbCheck.ok ? "ok" : "degraded";
    const totalLatency = Math.round(performance.now() - overallStart);

    const privileged = await isPrivilegedCaller(req);

    if (!privileged) {
      return new Response(
        JSON.stringify({ status, env: ENV, version: VERSION, latency_ms: totalLatency }),
        {
          status: dbCheck.ok ? 200 : 503,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
        },
      );
    }

    const authCheck = await timed(async () => {
      const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (error) throw error;
      return true;
    });
    const storageCheck = await timed(async () => {
      const { error } = await admin.storage.listBuckets();
      if (error) throw error;
      return true;
    });

    try {
      await admin.rpc("record_health_ping", {
        p_component: "edge:healthz",
        p_status: dbCheck.ok && authCheck.ok && storageCheck.ok ? "ok" : "degraded",
        p_latency_ms: totalLatency,
        p_detail: { db: dbCheck.ok, auth: authCheck.ok, storage: storageCheck.ok },
      });
    } catch (_) { /* noop */ }

    return new Response(
      JSON.stringify({
        status,
        env: ENV,
        version: VERSION,
        latency_ms: totalLatency,
        checks: {
          db: { ok: dbCheck.ok, latency_ms: dbCheck.latency_ms, error: dbCheck.error },
          auth: { ok: authCheck.ok, latency_ms: authCheck.latency_ms, error: authCheck.error },
          storage: { ok: storageCheck.ok, latency_ms: storageCheck.latency_ms, error: storageCheck.error },
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ status: "down", env: ENV, version: VERSION, error: String(e?.message ?? e) }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } },
    );
  }
});
