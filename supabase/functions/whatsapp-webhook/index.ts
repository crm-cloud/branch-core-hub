import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, x-hub-signature, x-hub-signature-256",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type WhatsAppIntegration = {
  id: string;
  branch_id: string | null;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
};

const integrationCache = new Map<string, WhatsAppIntegration | null>();

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === "GET") {
      return await handleVerification(req);
    }

    if (req.method === "POST") {
      return await handleEvent(req);
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", Allow: "GET, POST, OPTIONS" },
    });
  } catch (error) {
    console.error("whatsapp-webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleVerification(req: Request) {
  const url = new URL(req.url);
  const modeRaw = getQueryParam(url, ["hub.mode", "hub_mode", "mode"]);
  const verifyToken = getQueryParam(url, ["hub.verify_token", "hub_verify_token", "verify_token"]);
  const challenge = getQueryParam(url, ["hub.challenge", "hub_challenge", "challenge"]);
  const mode = modeRaw?.toLowerCase();

  if (mode !== "subscribe" || !verifyToken || !challenge) {
    const missingParams = [
      !modeRaw ? "hub.mode" : null,
      !verifyToken ? "hub.verify_token" : null,
      !challenge ? "hub.challenge" : null,
    ].filter(Boolean);

    return new Response(JSON.stringify({
      error: "Invalid verification request",
      expected_mode: "subscribe",
      received_mode: modeRaw,
      missing_params: missingParams,
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: integration, error } = await supabase
    .from("integration_settings")
    .select("id")
    .eq("integration_type", "whatsapp")
    .eq("is_active", true)
    .eq("config->>webhook_verify_token", verifyToken)
    .limit(1)
    .maybeSingle();

  if (error || !integration) {
    console.error("Invalid verify token", error);
    return new Response(JSON.stringify({ error: "Verification token not recognized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(challenge, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/plain" },
  });
}

function getQueryParam(url: URL, keys: string[]) {
  for (const key of keys) {
    const value = url.searchParams.get(key)?.trim();
    if (value) return value;
  }
  return null;
}

async function handleEvent(req: Request) {
  const bodyText = await req.text();
  let payload: any;
  try {
    payload = JSON.parse(bodyText);
  } catch (error) {
    console.error("Invalid JSON payload", error);
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (payload?.object && payload.object !== "whatsapp_business_account") {
    return new Response(JSON.stringify({ status: "ignored" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const phoneNumberIds = extractPhoneNumberIds(payload);
  const candidateIntegrations = await Promise.all(
    phoneNumberIds.map((id) => findIntegrationByPhoneNumberId(id)),
  );
  const signatureSecrets: string[] = Array.from(new Set(
    candidateIntegrations
      .map(getWebhookSignatureSecret)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  ));

  if (signatureSecrets.length > 0) {
    const signatureHeader = req.headers.get("x-hub-signature-256") ?? req.headers.get("x-hub-signature");
    if (!signatureHeader) {
      return new Response(JSON.stringify({ error: "Missing webhook signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isValidSignature = await verifyWebhookSignature(bodyText, signatureHeader, signatureSecrets);
    if (!isValidSignature) {
      return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  if (entries.length === 0) {
    return new Response(JSON.stringify({ status: "ignored" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  for (const entry of entries) {
    if (!Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      const value = change?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const integration = await findIntegrationByPhoneNumberId(String(phoneNumberId));
      if (!integration?.branch_id) {
        console.warn("Unable to map phone number id to an active WhatsApp integration", phoneNumberId);
        continue;
      }

      await Promise.all([
        processIncomingMessages(value, integration.branch_id),
        processStatusUpdates(value, integration.branch_id),
      ]);
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function findIntegrationByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppIntegration | null> {
  if (integrationCache.has(phoneNumberId)) {
    return integrationCache.get(phoneNumberId)!;
  }

  const { data, error } = await supabase
    .from("integration_settings")
    .select("id, branch_id, config, credentials")
    .eq("integration_type", "whatsapp")
    .eq("is_active", true)
    .eq("config->>phone_number_id", phoneNumberId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching integration for webhook", error);
  }

  const result = (data as WhatsAppIntegration | null) ?? null;
  integrationCache.set(phoneNumberId, result);
  return result;
}

async function processIncomingMessages(value: any, branchId: string) {
  const messages = Array.isArray(value.messages) ? value.messages : [];
  const contactName = value.contacts?.[0]?.profile?.name ?? null;

  for (const message of messages) {
    if (!message?.from || !message?.id) continue;

    const { data: existing } = await supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("whatsapp_message_id", message.id)
      .maybeSingle();

    if (existing) continue;

    const payload = {
      branch_id: branchId,
      phone_number: message.from,
      contact_name: contactName,
      message_type: message.type ?? "text",
      content: extractMessageContent(message),
      media_url: extractMediaUrl(message),
      direction: "inbound",
      status: "received",
      whatsapp_message_id: message.id,
    };

    const { error } = await supabase.from("whatsapp_messages").insert(payload);
    if (error) {
      console.error("Failed to insert WhatsApp inbound message", error);
    }
  }
}

async function processStatusUpdates(value: any, branchId: string) {
  const statuses = Array.isArray(value.statuses) ? value.statuses : [];

  for (const status of statuses) {
    if (!status?.id) continue;

    const { error } = await supabase
      .from("whatsapp_messages")
      .update({ status: status.status ?? "sent", updated_at: new Date().toISOString() })
      .eq("whatsapp_message_id", status.id)
      .eq("branch_id", branchId);

    if (error) {
      console.error("Failed to update WhatsApp message status", error);
    }
  }
}

function extractMessageContent(message: any): string | null {
  if (message?.text?.body) return message.text.body;
  if (message?.caption) return message.caption;
  if (message?.image?.caption) return message.image.caption;
  if (message?.document?.filename) return message.document.filename;
  if (message?.template?.name) return message.template.name;
  return null;
}

function extractMediaUrl(message: any): string | null {
  return message?.image?.id ?? message?.video?.id ?? message?.document?.id ?? null;
}

function extractPhoneNumberIds(payload: any): string[] {
  const ids = new Set<string>();
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const id = change?.value?.metadata?.phone_number_id;
      if (id) ids.add(String(id));
    }
  }

  return Array.from(ids);
}

function getWebhookSignatureSecret(integration: WhatsAppIntegration | null): string | null {
  if (!integration) return null;
  const appSecret = integration.credentials?.app_secret;
  if (typeof appSecret === "string" && appSecret.trim().length > 0) return appSecret.trim();

  const apiKey = integration.credentials?.api_key;
  if (typeof apiKey === "string" && apiKey.trim().length > 0) return apiKey.trim();

  return null;
}

function parseSignatureHeader(signatureHeader: string): string | null {
  const trimmed = signatureHeader.trim();
  if (!trimmed) return null;

  if (trimmed.includes("=")) {
    const [algorithm, value] = trimmed.split("=", 2);
    if (algorithm.toLowerCase() !== "sha256") return null;
    return value?.trim().toLowerCase() ?? null;
  }

  return trimmed.toLowerCase();
}

async function verifyWebhookSignature(body: string, signatureHeader: string, secrets: string[]) {
  const expectedSignature = parseSignatureHeader(signatureHeader);
  if (!expectedSignature) return false;

  for (const secret of secrets) {
    const computed = await computeHmacSha256(body, secret);
    if (computed === expectedSignature) {
      return true;
    }
  }

  return false;
}

async function computeHmacSha256(message: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
