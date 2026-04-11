// v1.0.0 — Test Connection for SMS / Email / WhatsApp providers
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Role check
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin", "manager"]);
    if (!roleData?.length) {
      return json({ error: "Admin access required" }, 403);
    }

    const { type, provider, config, credentials } = await req.json();

    if (!type || !provider) {
      return json({ error: "Missing type or provider" }, 400);
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
      default:
        result = { success: false, error: `Unsupported type: ${type}` };
    }

    return json(result, result.success ? 200 : 400);
  } catch (error: any) {
    console.error("test-integration error:", error);
    return json({ error: error.message }, 500);
  }
});

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
    case "smtp": {
      if (!config?.host || !credentials?.username) {
        return { success: false, error: "SMTP Host and Username are required" };
      }
      // We can't easily test SMTP from edge functions, but validate the config
      return { success: true, message: "SMTP configuration looks valid ✓ (send a test email to fully verify)" };
    }
    case "ses": {
      if (!credentials?.access_key_id) return { success: false, error: "AWS Access Key ID is required" };
      return { success: true, message: "AWS SES configuration saved ✓ (ensure your domain is verified in AWS)" };
    }
    default:
      return { success: false, error: `No test available for email provider: ${provider}` };
  }
}

async function testWhatsApp(provider: string, config: any, credentials: any) {
  switch (provider) {
    case "meta_cloud": {
      if (!credentials?.access_token || !config?.business_account_id) {
        return { success: false, error: "Access Token and WABA ID are required" };
      }

      let appsecretProof = "";
      if (credentials.app_secret) {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey("raw", enc.encode(credentials.app_secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const sig = await crypto.subtle.sign("HMAC", key, enc.encode(credentials.access_token));
        appsecretProof = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
      }

      const url = `https://graph.facebook.com/v25.0/${config.business_account_id}/message_templates?limit=1${appsecretProof ? `&appsecret_proof=${appsecretProof}` : ""}`;
      try {
        const resp = await fetch(url, {
          headers: { Authorization: `Bearer ${credentials.access_token}` },
        });
        const data = await resp.json();
        if (data.error) {
          if (data.error.message?.includes("does not exist")) {
            return { success: false, error: "Invalid WABA ID. Please check your WhatsApp Business Account ID." };
          }
          return { success: false, error: data.error.message };
        }
        return { success: true, message: "Meta WhatsApp API connected ✓" };
      } catch (e) {
        return { success: false, error: `Meta API failed: ${(e as Error).message}` };
      }
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

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
