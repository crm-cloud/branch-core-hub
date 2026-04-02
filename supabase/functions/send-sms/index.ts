// v1.0.0 — Multi-provider SMS Edge Function
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { phone, message, branch_id, provider: providerOverride } = body;

    if (!phone || !message) {
      return json({ error: "Missing phone or message" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get active SMS integration
    let query = supabase
      .from("integration_settings")
      .select("*")
      .eq("integration_type", "sms")
      .eq("is_active", true);

    if (providerOverride) {
      query = query.eq("provider", providerOverride);
    }

    const { data: integrations, error: intError } = await query.limit(1);
    if (intError || !integrations?.length) {
      return json({ error: "No active SMS provider configured" }, 400);
    }

    const integration = integrations[0];
    const config = integration.config || {};
    const credentials = integration.credentials || {};
    const provider = integration.provider;

    let result: { success: boolean; message_id?: string; error?: string };

    switch (provider) {
      case "roundsms":
        result = await sendRoundSMS(phone, message, config, credentials);
        break;
      case "msg91":
        result = await sendMSG91(phone, message, config, credentials);
        break;
      case "twilio":
        result = await sendTwilio(phone, message, config, credentials);
        break;
      case "textlocal":
        result = await sendTextLocal(phone, message, config, credentials);
        break;
      case "fast2sms":
        result = await sendFast2SMS(phone, message, config, credentials);
        break;
      default:
        result = { success: false, error: `Unsupported provider: ${provider}` };
    }

    // Log to sms_logs
    await supabase.from("sms_logs").insert({
      phone,
      message,
      status: result.success ? "sent" : "failed",
      message_id: result.message_id || null,
      provider,
      branch_id: branch_id || null,
      error_message: result.error || null,
    });

    if (result.success) {
      return json({ success: true, message_id: result.message_id });
    }
    return json({ error: result.error || "SMS sending failed" }, 500);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});

async function sendRoundSMS(
  phone: string,
  message: string,
  config: Record<string, string>,
  credentials: Record<string, string>,
) {
  const cleanPhone = phone.replace(/^(\+?91)/, "");
  const apiUrl = config.api_url || "http://voice.roundsms.co/api/sendmsg.php";
  const priority = config.priority || "ndnd";
  const stype = config.sms_type || "normal";

  const url = `${apiUrl}?user=${encodeURIComponent(credentials.username || "")}&pass=${encodeURIComponent(credentials.password || "")}&sender=${encodeURIComponent(config.sender_id || "")}&phone=${cleanPhone}&text=${encodeURIComponent(message)}&priority=${priority}&stype=${stype}`;

  try {
    const resp = await fetch(url);
    const text = await resp.text();
    if (text.startsWith("S.")) {
      return { success: true, message_id: text.trim() };
    }
    return { success: false, error: `RoundSMS error: ${text.trim()}` };
  } catch (e) {
    return { success: false, error: `RoundSMS fetch failed: ${(e as Error).message}` };
  }
}

async function sendMSG91(
  phone: string,
  message: string,
  config: Record<string, string>,
  credentials: Record<string, string>,
) {
  const cleanPhone = phone.replace(/^(\+?91)/, "");
  const url = "https://control.msg91.com/api/v5/flow/";
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: credentials.auth_key || "",
      },
      body: JSON.stringify({
        sender: config.sender_id,
        route: config.route || "4",
        DLT_TE_ID: config.dlt_template_id,
        mobiles: `91${cleanPhone}`,
        message,
      }),
    });
    const data = await resp.json();
    if (data.type === "success") {
      return { success: true, message_id: data.request_id };
    }
    return { success: false, error: data.message || "MSG91 error" };
  } catch (e) {
    return { success: false, error: `MSG91 failed: ${(e as Error).message}` };
  }
}

async function sendTwilio(
  phone: string,
  message: string,
  config: Record<string, string>,
  credentials: Record<string, string>,
) {
  const sid = credentials.account_sid;
  const token = credentials.auth_token;
  const from = config.from_number;
  const to = phone.startsWith("+") ? phone : `+91${phone.replace(/^91/, "")}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from || "", Body: message }),
    });
    const data = await resp.json();
    if (data.sid) {
      return { success: true, message_id: data.sid };
    }
    return { success: false, error: data.message || "Twilio error" };
  } catch (e) {
    return { success: false, error: `Twilio failed: ${(e as Error).message}` };
  }
}

async function sendTextLocal(
  phone: string,
  message: string,
  _config: Record<string, string>,
  credentials: Record<string, string>,
) {
  const url = "https://api.textlocal.in/send/";
  const cleanPhone = phone.replace(/^(\+?91)/, "");
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        apikey: credentials.api_key || "",
        numbers: `91${cleanPhone}`,
        message,
      }),
    });
    const data = await resp.json();
    if (data.status === "success") {
      return { success: true, message_id: data.batch_id };
    }
    return { success: false, error: JSON.stringify(data.errors || data) };
  } catch (e) {
    return { success: false, error: `TextLocal failed: ${(e as Error).message}` };
  }
}

async function sendFast2SMS(
  phone: string,
  message: string,
  config: Record<string, string>,
  credentials: Record<string, string>,
) {
  const cleanPhone = phone.replace(/^(\+?91)/, "");
  const url = "https://www.fast2sms.com/dev/bulkV2";
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: credentials.api_key || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: config.route || "dlt",
        sender_id: config.sender_id,
        message: config.dlt_template_id,
        variables_values: message,
        flash: 0,
        numbers: cleanPhone,
      }),
    });
    const data = await resp.json();
    if (data.return) {
      return { success: true, message_id: data.request_id };
    }
    return { success: false, error: data.message?.[0] || "Fast2SMS error" };
  } catch (e) {
    return { success: false, error: `Fast2SMS failed: ${(e as Error).message}` };
  }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
