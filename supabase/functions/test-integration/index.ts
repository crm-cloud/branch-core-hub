// v1.3.0 — Phase G: pinned to shared META_API_BASE / IG_API_BASE (v25.0) with IG fallback.
// v1.2.0 — Instagram now auto-detects IGAA (Instagram Login) vs EAA (Facebook Login) tokens
//          and routes to graph.instagram.com or graph.facebook.com respectively.
// v1.1.0 — Test Connection for SMS / Email / WhatsApp / Instagram providers
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { META_API_BASE, IG_API_BASE, IG_FALLBACK_VERSION, IG_GRAPH_VERSION, metaFetchWithFallback } from "../_shared/meta-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatMetaError(error: string, platform: "whatsapp" | "instagram"): string {
  const lower = error.toLowerCase();
  if (lower.includes("appsecret_proof")) {
    return platform === "whatsapp"
      ? "Meta rejected app secret proof. Verify your access token and app secret belong to the same WhatsApp Meta app."
      : "Meta rejected app secret proof. Verify your access token and app secret belong to the same Instagram/Meta app.";
  }
  if (lower.includes("does not exist")) {
    return platform === "whatsapp"
      ? "Invalid WhatsApp Business Account ID. Check the WABA ID in your Meta configuration."
      : "Invalid Instagram/Page ID. Check the Instagram business account ID or linked Facebook Page ID.";
  }
  if (lower.includes("permission") || lower.includes("oauth") || lower.includes("token")) {
    return platform === "whatsapp"
      ? "Meta token was rejected or lacks permission. Re-enter the access token and confirm the app has WhatsApp permissions."
      : "Meta token was rejected or lacks permission. Re-enter the access token and confirm the app has Instagram/Page permissions.";
  }
  return error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "Unauthorized" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return json({ success: false, error: "Unauthorized" });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin", "manager"]);
    if (!roleData?.length) {
      return json({ success: false, error: "Admin access required" });
    }

    const { type, provider, config, credentials } = await req.json();

    if (!type || !provider) {
      return json({ success: false, error: "Missing type or provider" });
    }

    let result: { success: boolean; message?: string; error?: string };

    switch (type) {
      case "sms":
        result = await testSMS(provider, config, credentials);
        break;
      case "email":
        result = await testEmail(provider, config, credentials, user.email || "");
        break;
      case "whatsapp":
        result = await testWhatsApp(provider, config, credentials);
        break;
      case "instagram":
        result = await testInstagram(config, credentials);
        break;
      case "messenger":
      case "facebook_messenger":
        result = {
          success: false,
          error: "Messenger integration is not yet supported end-to-end. This provider has been temporarily disabled in the UI.",
        };
        break;
      default:
        result = { success: false, error: `Unsupported type: ${type}` };
    }

    // Always return 200 so supabase.functions.invoke gives us the body
    return json(result);
  } catch (error: any) {
    console.error("test-integration error:", error);
    return json({ success: false, error: error.message });
  }
});

// ── SMS ─────────────────────────────────────────────

async function testSMS(provider: string, config: any, credentials: any) {
  switch (provider) {
    case "msg91": {
      if (!credentials?.auth_key) return { success: false, error: "Auth Key is required" };
      try {
        const resp = await fetch("https://control.msg91.com/api/v5/flow/", {
          method: "GET",
          headers: { authkey: credentials.auth_key },
        });
        return resp.status !== 401
          ? { success: true, message: "MSG91 credentials verified ✓" }
          : { success: false, error: "Invalid MSG91 Auth Key" };
      } catch (e) {
        return { success: false, error: `MSG91 connection failed: ${(e as Error).message}` };
      }
    }
    case "roundsms": {
      const base = config?.api_base_url || "http://voice.roundsms.co/api";
      const endpoint = config?.balance_endpoint || "/checkbalance.php";
      const url = `${base}${endpoint}?user=${encodeURIComponent(credentials?.username || "")}&pass=${encodeURIComponent(credentials?.password || "")}`;
      try {
        const resp = await fetch(url);
        const text = await resp.text();
        if (text.toLowerCase().includes("error") || text.toLowerCase().includes("invalid")) {
          return { success: false, error: `RoundSMS: ${text.trim()}` };
        }
        return { success: true, message: `RoundSMS connected ✓ Balance: ${text.trim()}` };
      } catch (e) {
        return { success: false, error: `RoundSMS connection failed: ${(e as Error).message}` };
      }
    }
    case "twilio": {
      const sid = credentials?.account_sid;
      const token = credentials?.auth_token;
      if (!sid || !token) return { success: false, error: "Account SID and Auth Token required" };
      try {
        const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
          headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}` },
        });
        return resp.ok
          ? { success: true, message: "Twilio credentials verified ✓" }
          : { success: false, error: "Invalid Twilio credentials" };
      } catch (e) {
        return { success: false, error: `Twilio connection failed: ${(e as Error).message}` };
      }
    }
    default:
      return { success: false, error: `No test available for SMS provider: ${provider}` };
  }
}

// ── Email ───────────────────────────────────────────

async function testEmail(provider: string, config: any, credentials: any, adminEmail: string) {
  switch (provider) {
    case "sendgrid": {
      if (!credentials?.api_key) return { success: false, error: "API Key is required" };
      try {
        const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${credentials.api_key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: adminEmail }] }],
            from: { email: config?.from_email || "test@test.com", name: config?.from_name || "Incline Fitness" },
            subject: "🧪 Test Email — Incline Fitness",
            content: [{ type: "text/html", value: "<h2>✅ Email integration is working!</h2><p>This is a test email from Incline Fitness CRM.</p>" }],
          }),
        });
        return resp.ok || resp.status === 202
          ? { success: true, message: `Test email sent to ${adminEmail} ✓` }
          : { success: false, error: `SendGrid error: ${resp.status}` };
      } catch (e) {
        return { success: false, error: `SendGrid failed: ${(e as Error).message}` };
      }
    }
    case "mailgun": {
      if (!credentials?.api_key || !config?.domain) return { success: false, error: "API Key and Domain are required" };
      try {
        const resp = await fetch(`https://api.mailgun.net/v3/${config.domain}/messages`, {
          method: "POST",
          headers: { Authorization: `Basic ${btoa(`api:${credentials.api_key}`)}` },
          body: new URLSearchParams({
            from: `${config.from_name || "Test"} <${config.from_email || `test@${config.domain}`}>`,
            to: adminEmail,
            subject: "🧪 Test Email — Incline Fitness",
            html: "<h2>✅ Email integration is working!</h2><p>This is a test email from Incline Fitness CRM.</p>",
          }),
        });
        return resp.ok
          ? { success: true, message: `Test email sent to ${adminEmail} ✓` }
          : { success: false, error: `Mailgun error: ${resp.status}` };
      } catch (e) {
        return { success: false, error: `Mailgun failed: ${(e as Error).message}` };
      }
    }
    case "smtp":
      if (!config?.host || !credentials?.username) {
        return { success: false, error: "SMTP Host and Username are required" };
      }
      return { success: true, message: "SMTP configuration looks valid ✓ (send a test email to fully verify)" };
    case "ses":
      if (!credentials?.access_key_id) return { success: false, error: "AWS Access Key ID is required" };
      return { success: true, message: "AWS SES configuration saved ✓ (ensure your domain is verified in AWS)" };
    default:
      return { success: false, error: `No test available for email provider: ${provider}` };
  }
}

// ── WhatsApp ────────────────────────────────────────

async function testWhatsApp(provider: string, config: any, credentials: any) {
  switch (provider) {
    case "meta_cloud": {
      if (!credentials?.access_token || !config?.business_account_id) {
        return { success: false, error: "Access Token and WABA ID are required" };
      }

      const result = await fetchMetaGraph(
        `${META_API_BASE}/${config.business_account_id}/message_templates?limit=1`,
        credentials.access_token,
        credentials.app_secret,
      );

      if (!result.ok) {
        if (result.error?.includes("does not exist")) {
          return { success: false, error: "Invalid WABA ID. Please check your WhatsApp Business Account ID." };
        }
        return { success: false, error: formatMetaError(result.error || "Meta WhatsApp API test failed", "whatsapp") };
      }

      const usedFallback = result.usedFallback && !!credentials?.app_secret;
      return {
        success: true,
        message: usedFallback
          ? "Meta WhatsApp API connected ✓ (verified without app secret proof)"
          : "Meta WhatsApp API connected ✓",
        warning: usedFallback
          ? "App Secret was provided but Meta rejected the proof. Calls that require appsecret_proof will fail later. Verify your app secret matches the one in Meta Dashboard → App Settings → Basic, or remove it to disable proof."
          : undefined,
      };
    }
    case "wati": {
      if (!credentials?.access_token || !config?.api_endpoint_url) {
        return { success: false, error: "API Endpoint and Access Token are required" };
      }
      try {
        const resp = await fetch(`${config.api_endpoint_url}/api/v1/getTemplates`, {
          headers: { Authorization: `Bearer ${credentials.access_token}` },
        });
        return resp.ok
          ? { success: true, message: "WATI connected ✓" }
          : { success: false, error: `WATI error: ${resp.status}` };
      } catch (e) {
        return { success: false, error: `WATI failed: ${(e as Error).message}` };
      }
    }
    case "aisensy": {
      if (!credentials?.api_key) return { success: false, error: "API Key is required" };
      return { success: true, message: "AiSensy API Key configured ✓" };
    }
    default:
      return { success: false, error: `No test available for WhatsApp provider: ${provider}` };
  }
}

// ── Instagram ───────────────────────────────────────
// Two valid Meta flows are supported:
//
//   A) "API setup with Facebook login"  → token starts with `EAA…`
//      - host:    graph.facebook.com/v25.0
//      - probe:   /{page_id}?fields=id,name,instagram_business_account
//      - account: config.page_id  (FB Page that owns the IG Business account)
//
//   B) "API setup with Instagram login" → token starts with `IGAA…`
//      - host:    graph.instagram.com/v23.0
//      - probe:   /me?fields=user_id,username,name,account_type
//      - account: config.instagram_account_id (IG user_id from /me)
//
// We auto-detect from the token prefix and call the matching host.
async function testInstagram(config: any, credentials: any) {
  const accessToken: string | undefined =
    credentials?.access_token || credentials?.page_access_token;
  if (!accessToken) return { success: false, error: "Access Token is required" };

  const isInstagramLogin = accessToken.trim().startsWith("IGAA");

  if (isInstagramLogin) {
    // ── Instagram Login flow (graph.instagram.com) ──
    // App Secret proof is NOT used here — Instagram Login tokens are scoped
    // and Meta does not honour appsecret_proof on graph.instagram.com.
    const meResp = await metaFetchWithFallback(
      `${IG_API_BASE}/me?fields=user_id,username,name,account_type`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const meData = await meResp.json().catch(() => ({}));
    if (!meResp.ok || meData?.error) {
      const msg = meData?.error?.message || `HTTP ${meResp.status}`;
      return {
        success: false,
        error: `Instagram Login API: ${formatMetaError(msg, "instagram")}\n` +
          `Token detected as Instagram Login (IGAA…). Make sure your Meta app has ` +
          `permissions: instagram_business_basic, instagram_business_manage_messages, instagram_manage_comments. ` +
          `If you used "API setup with Facebook login", regenerate as a Page Access Token (EAA…) instead.`,
      };
    }

    const expectedAccount = config?.instagram_account_id;
    const actualAccount = String(meData?.user_id || meData?.id || "");
    if (expectedAccount && expectedAccount !== actualAccount) {
      return {
        success: false,
        error: `Instagram Login token is for IG account ${actualAccount} (@${meData?.username || "?"}), ` +
          `but Integration is configured for ${expectedAccount}. Update "Instagram Account ID" to ${actualAccount}.`,
      };
    }

    const accountType = String(meData?.account_type || "").toUpperCase();
    const isMessagingCapable = accountType === "BUSINESS";
    return {
      success: true,
      message: `Instagram Login connected ✓ @${meData?.username || meData?.name || actualAccount}` +
        (accountType ? ` · ${accountType}` : "") +
        (!isMessagingCapable ? " ⚠ Convert IG account to BUSINESS to send DMs" : ""),
      detected_flow: "instagram_login",
      detected_account_id: actualAccount,
      warning: !isMessagingCapable
        ? `Your Instagram account is "${accountType}". The Instagram Messaging API only works for BUSINESS accounts. Convert in IG Settings → Account → Switch to Professional → Business.`
        : undefined,
    };
  }

  // ── Facebook Login flow (graph.facebook.com) ──
  const pageId = config?.page_id || config?.instagram_account_id;
  if (!pageId) {
    return {
      success: false,
      error: "Facebook Page ID is required when using a Facebook Login token (EAA…). " +
        "Paste the linked Page ID into the Page ID field.",
    };
  }

  const entity = await fetchMetaGraph(
    `${META_API_BASE}/${pageId}?fields=id,name,instagram_business_account{id,username,name}`,
    accessToken,
    credentials?.app_secret,
  );
  if (!entity.ok) {
    return {
      success: false,
      error: `Meta API: ${formatMetaError(entity.error || "Instagram test failed", "instagram")}\n` +
        `Token detected as Facebook Login (EAA…). Verify the Page Access Token belongs to the Page that owns the IG Business account.`,
    };
  }

  const ig = entity.data?.instagram_business_account;
  if (!ig?.id) {
    return {
      success: false,
      error: `Page "${entity.data?.name || pageId}" has no linked Instagram Business account. ` +
        `Link the IG account in Meta Business Suite → Settings → Instagram Accounts.`,
    };
  }

  if (config?.instagram_account_id && String(config.instagram_account_id) !== String(ig.id)) {
    return {
      success: false,
      error: `Page is linked to IG account ${ig.id} (@${ig.username}), but Integration has ${config.instagram_account_id}. Update it.`,
    };
  }

  const usedFallback = entity.usedFallback && !!credentials?.app_secret;
  return {
    success: true,
    message: `Instagram (Facebook Login) connected ✓ @${ig.username || ig.name || ig.id} via Page "${entity.data?.name}"` +
      (usedFallback ? " — without appsecret_proof" : ""),
    detected_flow: "facebook_login",
    detected_account_id: ig.id,
    warning: usedFallback
      ? "App Secret was provided but Meta rejected the proof. Outbound DMs may fail later. Verify the App Secret matches Meta App → Settings → Basic."
      : undefined,
  };
}

async function testMessenger(config: any, credentials: any) {
  const accessToken = credentials?.page_access_token || credentials?.access_token;
  if (!accessToken) return { success: false, error: "Page Access Token is required" };

  const pageId = config?.page_id;
  if (!pageId) return { success: false, error: "Facebook Page ID is required" };

  const entity = await fetchMetaGraph(
    `${META_API_BASE}/${pageId}?fields=id,name,category`,
    accessToken,
    credentials?.app_secret,
  );
  if (!entity.ok) {
    return { success: false, error: `Meta API: ${formatMetaError(entity.error || "Messenger test failed", "instagram")}` };
  }

  // Verify Messenger is enabled by reading subscribed_apps (may require pages_messaging perm)
  const subs = await fetchMetaGraph(
    `${META_API_BASE}/${pageId}/subscribed_apps`,
    accessToken,
    credentials?.app_secret,
  );

  return {
    success: true,
    message: `Messenger connected ✓ (Page: ${entity.data?.name || pageId})${subs.ok ? "" : " — note: enable webhook subscription for inbound messages"}`,
  };
}

// ── Utility ─────────────────────────────────────────

async function fetchMetaGraph(
  baseUrl: string,
  accessToken: string,
  appSecret?: string,
): Promise<{ ok: boolean; data?: any; error?: string; usedFallback?: boolean }> {
  const proof = appSecret ? await hmacSha256(appSecret, accessToken) : "";
  const urls = [
    `${baseUrl}${proof ? `${baseUrl.includes("?") ? "&" : "?"}appsecret_proof=${proof}` : ""}`,
  ];

  if (proof) {
    urls.push(baseUrl);
  }

  let lastError: string | undefined;

  for (let i = 0; i < urls.length; i++) {
    try {
      const resp = await fetch(urls[i], {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await resp.json();
      if (data?.error) {
        lastError = data.error.message || "Meta API request failed";
        if (i === 0 && lastError && /appsecret_proof/i.test(lastError)) {
          continue;
        }
        return { ok: false, error: lastError, usedFallback: i > 0 };
      }
      return { ok: true, data, usedFallback: i > 0 };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Meta API request failed";
    }
  }

  return { ok: false, error: lastError || "Meta API request failed" };
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}
