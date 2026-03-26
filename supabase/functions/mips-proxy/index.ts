const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cachedToken: string | null = null;
let tokenExpiry = 0;

function getBaseUrl(): string {
  return Deno.env.get("MIPS_SERVER_URL")!.replace(/\/+$/, "");
}

async function getRuoYiToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const username = Deno.env.get("MIPS_USERNAME")!;
  const password = Deno.env.get("MIPS_PASSWORD")!;
  const baseUrl = getBaseUrl();

  console.log(`RuoYi auth: POST ${baseUrl}/login`);

  const res = await fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "TENANT-ID": "1" },
    body: JSON.stringify({ username, password }),
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`RuoYi login returned non-JSON: ${text.substring(0, 300)}`);
  }

  if (json.code !== 200 && json.code !== 0) {
    throw new Error(`RuoYi login failed (code=${json.code}): ${json.msg || JSON.stringify(json)}`);
  }

  cachedToken = json.token || json.data?.token;
  if (!cachedToken) throw new Error(`No token in RuoYi login response: ${JSON.stringify(json)}`);
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

    const token = await getRuoYiToken();
    const baseUrl = getBaseUrl();

    let url = `${baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) searchParams.set(k, v);
      url += `?${searchParams.toString()}`;
    }

    const upperMethod = method.toUpperCase();

    const fetchOptions: RequestInit = {
      method: upperMethod,
      headers: {
        "Authorization": `Bearer ${token}`,
        "TENANT-ID": "1",
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    };

    if (data && ["POST", "PUT", "PATCH", "DELETE"].includes(upperMethod)) {
      fetchOptions.body = JSON.stringify(data);
    }

    console.log(`MIPS proxy: ${upperMethod} ${url}`);

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
