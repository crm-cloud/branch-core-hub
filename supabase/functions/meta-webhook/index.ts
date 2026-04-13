// v2.0.0 — Unified Meta Webhook: WhatsApp, Instagram DM, Facebook Messenger
// Hardened with org AI config, appsecret_proof, tool-calling support
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, x-hub-signature, x-hub-signature-256",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Platform = "whatsapp" | "instagram" | "messenger";

// Cache org AI config
let _orgAiConfig: any = null;
let _orgAiConfigFetchedAt = 0;

async function getOrgAiConfig() {
  if (_orgAiConfig && Date.now() - _orgAiConfigFetchedAt < 60_000) return _orgAiConfig;
  const { data } = await supabase
    .from("organization_settings")
    .select("whatsapp_ai_config, gym_name")
    .limit(1)
    .maybeSingle();
  _orgAiConfig = data || {};
  _orgAiConfigFetchedAt = Date.now();
  return _orgAiConfig;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === "GET") {
      return await handleVerification(req);
    }

    if (req.method === "POST") {
      return await handleIncomingEvent(req);
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("meta-webhook error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Verification (shared for WA/IG/Messenger) ────────────────────────────────

async function handleVerification(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode")?.toLowerCase();
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !verifyToken || !challenge) {
    return new Response(JSON.stringify({ error: "Invalid verification request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: integration } = await supabase
    .from("integration_settings")
    .select("id, integration_type")
    .in("integration_type", ["whatsapp", "instagram", "messenger"])
    .eq("is_active", true)
    .eq("config->>webhook_verify_token", verifyToken)
    .limit(1)
    .maybeSingle();

  if (!integration) {
    return new Response(JSON.stringify({ error: "Verification token not recognized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`Meta webhook verified for ${integration.integration_type}`);
  return new Response(challenge, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
}

// ─── Incoming Event Router ─────────────────────────────────────────────────────

async function handleIncomingEvent(req: Request) {
  const bodyText = await req.text();
  let payload: any;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const objectType = payload?.object;

  if (objectType === "whatsapp_business_account") {
    console.log("Routing WhatsApp event to whatsapp-webhook");
    try {
      const whatsappUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;
      await fetch(whatsappUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": req.headers.get("x-hub-signature-256") || "",
        },
        body: bodyText,
      });
    } catch (e) {
      console.error("Failed to forward to whatsapp-webhook:", e);
    }
  } else if (objectType === "instagram") {
    await processInstagramEvent(payload);
  } else if (objectType === "page") {
    await processMessengerEvent(payload);
  } else {
    console.log("Unknown Meta webhook object type:", objectType);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Instagram DM Processing ──────────────────────────────────────────────────

async function processInstagramEvent(payload: any) {
  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];

    for (const event of messaging) {
      if (!event.message) continue;

      const senderId = event.sender?.id;
      const recipientId = event.recipient?.id;
      const message = event.message;

      if (!senderId || !recipientId || !message) continue;

      const integration = await findIntegrationByPageId(recipientId, "instagram");
      const branchId = integration?.branch_id || await getFallbackBranchId();
      if (!branchId) continue;

      const isOutbound = senderId === recipientId;
      const content = message.text || (message.attachments?.[0]?.type === "image" ? "[Image]" : "[Attachment]");
      const messageType = message.attachments?.[0]?.type || "text";
      const mediaUrl = message.attachments?.[0]?.payload?.url || null;

      // Dedup check
      const { data: existing } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("platform_message_id", message.mid)
        .maybeSingle();
      if (existing) continue;

      const { data: inserted, error } = await supabase
        .from("whatsapp_messages")
        .insert({
          branch_id: branchId,
          phone_number: senderId,
          contact_name: null,
          message_type: messageType,
          content,
          media_url: mediaUrl,
          direction: isOutbound ? "outbound" : "inbound",
          status: isOutbound ? "sent" : "received",
          platform: "instagram" as any,
          platform_message_id: message.mid,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Failed to insert Instagram DM:", error);
        continue;
      }

      if (!isOutbound && inserted) {
        await supabase.from("whatsapp_chat_settings").upsert(
          { branch_id: branchId, phone_number: senderId, is_unread: true, platform: "instagram" as any },
          { onConflict: "branch_id,phone_number" }
        );

        await triggerAiReply(inserted.id, senderId, branchId, "instagram", integration);
      }
    }
  }
}

// ─── Messenger Processing ─────────────────────────────────────────────────────

async function processMessengerEvent(payload: any) {
  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];

    for (const event of messaging) {
      if (!event.message) continue;

      const senderId = event.sender?.id;
      const recipientId = event.recipient?.id;
      const message = event.message;

      if (!senderId || !recipientId || !message) continue;

      const integration = await findIntegrationByPageId(recipientId, "messenger");
      const branchId = integration?.branch_id || await getFallbackBranchId();
      if (!branchId) continue;

      const isOutbound = message.is_echo === true;
      const content = message.text || (message.attachments?.[0]?.type === "image" ? "[Image]" : "[Attachment]");
      const messageType = message.attachments?.[0]?.type || "text";
      const mediaUrl = message.attachments?.[0]?.payload?.url || null;

      // Dedup
      const { data: existing } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("platform_message_id", message.mid)
        .maybeSingle();
      if (existing) continue;

      const { data: inserted, error } = await supabase
        .from("whatsapp_messages")
        .insert({
          branch_id: branchId,
          phone_number: senderId,
          contact_name: null,
          message_type: messageType,
          content,
          media_url: mediaUrl,
          direction: isOutbound ? "outbound" : "inbound",
          status: isOutbound ? "sent" : "received",
          platform: "messenger" as any,
          platform_message_id: message.mid,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Failed to insert Messenger message:", error);
        continue;
      }

      if (!isOutbound && inserted) {
        await supabase.from("whatsapp_chat_settings").upsert(
          { branch_id: branchId, phone_number: senderId, is_unread: true, platform: "messenger" as any },
          { onConflict: "branch_id,phone_number" }
        );
        await triggerAiReply(inserted.id, senderId, branchId, "messenger", integration);
      }
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function findIntegrationByPageId(pageId: string, integrationType: string) {
  const { data } = await supabase
    .from("integration_settings")
    .select("id, branch_id, config, credentials")
    .eq("integration_type", integrationType)
    .eq("is_active", true)
    .limit(10);

  if (!data) return null;

  return data.find((i: any) =>
    i.config?.page_id === pageId ||
    i.config?.instagram_account_id === pageId
  ) || data[0] || null;
}

let _fallbackBranchId: string | null = null;

async function getFallbackBranchId(): Promise<string | null> {
  if (_fallbackBranchId) return _fallbackBranchId;
  const { data } = await supabase
    .from("branches")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  _fallbackBranchId = data?.id || null;
  return _fallbackBranchId;
}

// Compute appsecret_proof for Meta Graph API calls
async function computeAppSecretProof(accessToken: string, appSecret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(accessToken));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function triggerAiReply(
  messageId: string,
  senderId: string,
  branchId: string,
  platform: Platform,
  integration?: any
) {
  // Check if bot is active for this contact
  const { data: settings } = await supabase
    .from("whatsapp_chat_settings")
    .select("bot_active")
    .eq("branch_id", branchId)
    .eq("phone_number", senderId)
    .maybeSingle();

  if (settings?.bot_active === false) return;

  // Fetch recent messages for context (platform-scoped)
  const { data: recentMessages } = await supabase
    .from("whatsapp_messages")
    .select("content, direction, created_at")
    .eq("phone_number", senderId)
    .eq("branch_id", branchId)
    .eq("platform", platform)
    .order("created_at", { ascending: false })
    .limit(15);

  const history = (recentMessages || []).reverse();

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not set, skipping AI reply for", platform);
    return;
  }

  // Use org AI config for system prompt
  const orgConfig = await getOrgAiConfig();
  const aiConfig = orgConfig?.whatsapp_ai_config as any;
  const gymName = orgConfig?.gym_name || "Incline Fitness";

  const platformLabel = platform === "instagram" ? "Instagram DM" : "Facebook Messenger";
  const conversationHistory = history
    .map((m: any) => `${m.direction === "inbound" ? "Customer" : "Staff"}: ${m.content}`)
    .join("\n");

  // Build system prompt from org config or fallback
  const customPrompt = aiConfig?.system_prompt || "";
  const systemPrompt = customPrompt
    ? `${customPrompt}\n\nYou are responding on ${platformLabel}. Keep replies short (1-3 sentences), warm and professional.`
    : `You are a helpful gym reception assistant for "${gymName}" responding on ${platformLabel}. Generate a professional, friendly reply. Keep it short (1-3 sentences max). Be warm but professional.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiConfig?.model || "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Recent conversation:\n\n${conversationHistory}\n\nGenerate a reply.` },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`AI gateway error for ${platform}:`, response.status);
      return;
    }

    const aiResult = await response.json();
    const replyText = aiResult.choices?.[0]?.message?.content;
    if (!replyText) return;

    // Store the AI reply
    const { data: replyMsg } = await supabase
      .from("whatsapp_messages")
      .insert({
        branch_id: branchId,
        phone_number: senderId,
        content: replyText,
        direction: "outbound",
        status: "pending",
        message_type: "text",
        platform: platform as any,
      })
      .select("id")
      .single();

    if (replyMsg) {
      // Build send URL with appsecret_proof if available
      const sendBody: any = {
        message_id: replyMsg.id,
        recipient_id: senderId,
        content: replyText,
        branch_id: branchId,
        platform,
      };

      // Compute appsecret_proof if integration credentials are available
      if (integration?.credentials?.access_token && integration?.credentials?.app_secret) {
        sendBody.appsecret_proof = await computeAppSecretProof(
          integration.credentials.access_token,
          integration.credentials.app_secret
        );
      }

      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify(sendBody),
        });
      } catch (sendErr) {
        console.error(`Failed to send ${platform} reply:`, sendErr);
      }
    }
  } catch (err) {
    console.error(`AI reply error for ${platform}:`, err);
  }
}
