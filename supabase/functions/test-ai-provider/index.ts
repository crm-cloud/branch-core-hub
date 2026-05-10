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
        case "google": endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"; break;
        case "groq": endpoint = "https://api.groq.com/openai/v1/chat/completions"; break;
        case "together": endpoint = "https://api.together.xyz/v1/chat/completions"; break;
        case "mistral": endpoint = "https://api.mistral.ai/v1/chat/completions"; break;
        default: return json({ error: "base_url is required for this provider" }, 400);
      }
    }

    // Resolve API key. The field is the *name* of a Cloud secret, but if the user
    // pasted the actual key value (looks like a key, contains lowercase or special chars,
    // or starts with known prefixes), use it directly with a soft warning.
    let apiKey: string | null = null;
    let pasted_raw_key = false;
    if (api_key_secret_name) {
      const looksLikeRawKey =
        /^(sk-|sk_|aiza|gsk_|tgp_|key-|or-)/i.test(api_key_secret_name) ||
        /[a-z]/.test(api_key_secret_name) && api_key_secret_name.length > 25 && !/^[A-Z0-9_]+$/.test(api_key_secret_name);
      if (looksLikeRawKey) {
        apiKey = api_key_secret_name;
        pasted_raw_key = true;
      } else {
        apiKey = Deno.env.get(api_key_secret_name) ?? null;
      }
    }
    // Lovable AI uses the auto-provisioned LOVABLE_API_KEY
    if (!apiKey && provider === "lovable") {
      apiKey = Deno.env.get("LOVABLE_API_KEY") ?? null;
    }
    if (!apiKey && provider !== "ollama") {
      return json({
        error: `Secret '${api_key_secret_name}' is not set in Cloud → Settings → Secrets. Either add it there using this exact name, or paste the actual API key value into this field for a one-off test.`,
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

    // OpenAI's newer chat models (gpt-5, o-series, gpt-4.1+) reject `max_tokens`
    // and require `max_completion_tokens`. Safest: always use the new param for
    // OpenAI; both old & new chat completion endpoints accept it.
    const usesCompletionTokens = provider === "openai";
    const reqBody: Record<string, any> = {
      model: default_model,
      messages: [{ role: "user", content: "Reply with the single word: pong" }],
      stream: false,
    };
    if (usesCompletionTokens) reqBody.max_completion_tokens = 10;
    else reqBody.max_tokens = 10;

    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(reqBody),
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
      pasted_raw_key,
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
