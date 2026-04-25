// Test an AI provider by sending a tiny completion and reporting latency.
// Used by the AI Providers Settings page.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: require an admin or owner
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData } = await userClient.auth.getUser();
    if (!authData?.user) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id);
    if (!roles?.some((r: any) => ["owner", "admin"].includes(r.role))) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const { provider, base_url, api_key_secret_name, default_model } = body;

    if (!provider || !default_model) {
      return json({ error: "provider and default_model are required" }, 400);
    }

    let endpoint = base_url;
    if (!endpoint) {
      switch (provider) {
        case "lovable": endpoint = LOVABLE_GATEWAY; break;
        case "openrouter": endpoint = "https://openrouter.ai/api/v1/chat/completions"; break;
        case "deepseek": endpoint = "https://api.deepseek.com/v1/chat/completions"; break;
        default: return json({ error: "base_url is required for this provider" }, 400);
      }
    }

    const apiKey = api_key_secret_name ? Deno.env.get(api_key_secret_name) : null;
    if (!apiKey && provider !== "ollama") {
      return json({
        error: `Secret '${api_key_secret_name}' is not set. Add it via Cloud → Settings → Secrets.`,
        secret_missing: true,
      }, 400);
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    if (provider === "openrouter") {
      headers["HTTP-Referer"] = "https://incline.lovable.app";
      headers["X-Title"] = "Incline CRM";
    }

    const start = Date.now();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 30_000);
    let success = false;
    let errorMsg = "";
    let sampleReply = "";

    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: default_model,
          messages: [{ role: "user", content: "Reply with the single word: pong" }],
          max_tokens: 10,
          stream: false,
        }),
        signal: ac.signal,
      });

      if (!resp.ok) {
        errorMsg = `HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`;
      } else {
        const j = await resp.json();
        sampleReply = j?.choices?.[0]?.message?.content ?? "(no content)";
        success = true;
      }
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    } finally {
      clearTimeout(timer);
    }

    const latency_ms = Date.now() - start;

    return json({
      success,
      latency_ms,
      sample_reply: sampleReply,
      error: errorMsg || undefined,
      endpoint,
      model: default_model,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json({ error: message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
