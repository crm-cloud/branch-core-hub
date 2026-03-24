import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory token cache
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getMIPSToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const MIPS_URL = Deno.env.get("MIPS_SERVER_URL")!.replace(/\/+$/, "");
  const MIPS_USER = Deno.env.get("MIPS_USERNAME")!;
  const MIPS_PASS = Deno.env.get("MIPS_PASSWORD")!;

  // MIPS API endpoints are always at the root (host:port), not under /MIPS
  const urlObj = new URL(MIPS_URL);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

  const res = await fetch(`${baseUrl}/apiExternal/generateToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ identity: MIPS_USER, pStr: MIPS_PASS }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MIPS auth failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const codeVal = Number(json.code);
  if (codeVal !== 200 && codeVal !== 0) {
    throw new Error(`MIPS auth error (code=${json.code}): ${json.msg || JSON.stringify(json)}`);
  }

  cachedToken = json.data || json.token || json.result;
  if (!cachedToken) throw new Error(`No token in MIPS response: ${JSON.stringify(json)}`);
  
  // Cache for 23 hours (tokens typically last 24h)
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return cachedToken!;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { endpoint, method = "GET", params, data } = body as {
      endpoint: string;
      method?: string;
      params?: Record<string, string>;
      data?: Record<string, unknown>;
    };

    if (!endpoint) {
      return new Response(JSON.stringify({ error: "Missing endpoint" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getMIPSToken();
    const MIPS_URL = Deno.env.get("MIPS_SERVER_URL")!.replace(/\/+$/, "");
    const mipsUrlObj = new URL(MIPS_URL);
    const mipsBase = `${mipsUrlObj.protocol}//${mipsUrlObj.host}`;

    // All MIPS API endpoints are at root (host:port/endpoint)
    let url = `${mipsBase}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) searchParams.set(k, v);
      url += `?${searchParams.toString()}`;
    }

    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        "owl-auth-token": token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };

    // For POST/PUT with data, encode as form-urlencoded
    if (data && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
      const formData = new URLSearchParams();
      for (const [k, v] of Object.entries(data)) {
        formData.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      }
      fetchOptions.body = formData.toString();
    }

    const mipsRes = await fetch(url, fetchOptions);
    const responseText = await mipsRes.text();

    let responseJson: unknown;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = { raw: responseText };
    }

    return new Response(JSON.stringify({
      success: mipsRes.ok,
      status: mipsRes.status,
      data: responseJson,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("mips-proxy error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
