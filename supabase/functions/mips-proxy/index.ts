const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cachedToken: string | null = null;
let tokenExpiry = 0;

function getBaseUrl(): string {
  return Deno.env.get("MIPS_SERVER_URL")!.replace(/\/+$/, "");
}

async function getMIPSToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const MIPS_USER = Deno.env.get("MIPS_USERNAME")!;
  const MIPS_PASS = Deno.env.get("MIPS_PASSWORD")!;
  const hostUrl = getHostUrl();

  const res = await fetch(`${hostUrl}/apiExternal/generateToken`, {
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
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return cachedToken!;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { endpoint, method = "GET", params, data, contentType } = body as {
      endpoint: string;
      method?: string;
      params?: Record<string, string>;
      data?: Record<string, unknown>;
      contentType?: string;
    };

    if (!endpoint) {
      return new Response(JSON.stringify({ error: "Missing endpoint" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getMIPSToken();
    const hostUrl = getHostUrl();

    let url = `${hostUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) searchParams.set(k, v);
      url += `?${searchParams.toString()}`;
    }

    const useJson = contentType === "json";
    const upperMethod = method.toUpperCase();

    const fetchOptions: RequestInit = {
      method: upperMethod,
      headers: {
        "Owl-Auth-Token": token,
        "Content-Type": useJson ? "application/json" : "application/x-www-form-urlencoded",
        "siteId": "1",
      },
    };

    if (data && ["POST", "PUT", "PATCH"].includes(upperMethod)) {
      if (useJson) {
        fetchOptions.body = JSON.stringify(data);
      } else {
        const formData = new URLSearchParams();
        for (const [k, v] of Object.entries(data)) {
          formData.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
        }
        fetchOptions.body = formData.toString();
      }
    }

    console.log(`MIPS proxy: ${upperMethod} ${url} (content-type: ${useJson ? "json" : "form"})`);

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
