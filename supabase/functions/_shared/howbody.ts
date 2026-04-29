// v1.0.0 — HOWBODY shared helpers (token cache + signed headers)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export function howbodyCreds() {
  const baseUrl = (Deno.env.get("HOWBODY_BASE_URL") || "").replace(/\/+$/, "");
  const userName = Deno.env.get("HOWBODY_USERNAME") || "";
  const appKey = Deno.env.get("HOWBODY_APPKEY") || "";
  if (!baseUrl || !userName || !appKey) {
    throw new Error("HOWBODY credentials missing — set HOWBODY_BASE_URL, HOWBODY_USERNAME, HOWBODY_APPKEY");
  }
  return { baseUrl, userName, appKey };
}

export async function getCachedToken(): Promise<{ token: string; expires_at: string }> {
  const sb = admin();
  const cutoff = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { data: existing } = await sb
    .from("howbody_tokens")
    .select("token,expires_at")
    .gt("expires_at", cutoff)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.token) return existing as { token: string; expires_at: string };

  const { baseUrl, userName, appKey } = howbodyCreds();
  const ts = Date.now();
  const resp = await fetch(`${baseUrl}/openApi/getToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, appKey, timeStamp: ts }),
  });
  const body = await resp.json().catch(() => ({}));
  if (body?.code !== 200 || !body?.data?.token) {
    throw new Error(`HOWBODY getToken failed: ${body?.message || resp.status}`);
  }
  const token = body.data.token as string;
  const expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
  await sb.from("howbody_tokens").insert({ token, expires_at: expiresAt });
  return { token, expires_at: expiresAt };
}

export async function howbodyAuthedHeaders(): Promise<Record<string, string>> {
  const { token } = await getCachedToken();
  const { appKey } = howbodyCreds();
  return {
    "Content-Type": "application/json",
    token,
    timestamp: String(Date.now()),
    appkey: appKey,
  };
}

export async function logWebhook(
  endpoint: string,
  third_uid: string | null,
  data_key: string | null,
  status_code: number,
  message: string,
  raw_payload: unknown,
) {
  try {
    await admin().from("howbody_webhook_log").insert({
      endpoint, third_uid, data_key, status_code, message, raw_payload,
    });
  } catch (_) { /* best-effort */ }
}
