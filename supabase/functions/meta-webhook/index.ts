// v3.1.0 — Unified Meta Webhook: WhatsApp + Instagram DM + Facebook Messenger
// E1: IG-via-Page detection inside Messenger handler
// E3: Cross-platform AI memory (history not filtered by platform)
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAllToolDefinitions } from "../_shared/ai-tools.ts";
import { executeSharedToolCall } from "../_shared/ai-tool-executor.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, x-hub-signature, x-hub-signature-256",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Platform = "whatsapp" | "instagram" | "messenger";

let _orgAiConfig: any = null;
let _orgAiConfigFetchedAt = 0;

async function getOrgAiConfig() {
  if (_orgAiConfig && Date.now() - _orgAiConfigFetchedAt < 60_000) return _orgAiConfig;
  const { data, error } = await supabase
    .from("organization_settings")
    .select("whatsapp_ai_config, name")
    .limit(1)
    .maybeSingle();
  if (error) console.error("[meta-webhook] getOrgAiConfig error:", error.message);
  _orgAiConfig = data ? { whatsapp_ai_config: (data as any).whatsapp_ai_config, gym_name: (data as any).name } : {};
  _orgAiConfigFetchedAt = Date.now();
  return _orgAiConfig;
}

// Cache active IG page IDs (refreshed every 60s) to detect IG-via-Page envelopes
let _igPageIds: Set<string> = new Set();
let _igPageIdsFetchedAt = 0;
async function getActiveIgPageIds(): Promise<Set<string>> {
  if (Date.now() - _igPageIdsFetchedAt < 60_000) return _igPageIds;
  const { data } = await supabase
    .from("integration_settings")
    .select("config")
    .eq("integration_type", "instagram")
    .eq("is_active", true);
  const set = new Set<string>();
  for (const row of data || []) {
    const cfg: any = (row as any).config || {};
    if (cfg.page_id) set.add(String(cfg.page_id));
    if (cfg.instagram_account_id) set.add(String(cfg.instagram_account_id));
  }
  _igPageIds = set;
  _igPageIdsFetchedAt = Date.now();
  return _igPageIds;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (req.method === "GET") return await handleVerification(req);
    if (req.method === "POST") return await handleIncomingEvent(req);
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[meta-webhook] error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleVerification(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode")?.toLowerCase();
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !verifyToken || !challenge) {
    return new Response(JSON.stringify({ error: "Invalid verification request" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[meta-webhook] verified for ${integration.integration_type}`);
  return new Response(challenge, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
}

async function handleIncomingEvent(req: Request) {
  const bodyText = await req.text();
  let payload: any;
  try { payload = JSON.parse(bodyText); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const objectType = payload?.object;
  console.log(`[meta-webhook] inbound object=${objectType} entries=${payload?.entry?.length || 0}`);

  if (objectType === "whatsapp_business_account") {
    console.log("[meta-webhook] routing → whatsapp-webhook");
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": req.headers.get("x-hub-signature-256") || "",
        },
        body: bodyText,
      });
    } catch (e) {
      console.error("[meta-webhook] forward to whatsapp-webhook failed:", e);
    }
  } else if (objectType === "instagram") {
    await processInstagramEvent(payload);
  } else if (objectType === "page") {
    // E1: page envelope can carry IG OR Messenger — detect by recipient/page id
    await processPageEnvelopeEvent(payload);
  } else {
    console.log("[meta-webhook] unknown object type:", objectType);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Page-envelope router (IG-via-Page OR pure Messenger) ─────────────────────

async function processPageEnvelopeEvent(payload: any) {
  const igPageIds = await getActiveIgPageIds();
  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];
    for (const event of messaging) {
      if (!event.message) continue;
      const recipientId = String(event.recipient?.id || "");
      const senderId = String(event.sender?.id || "");
      const isIg = igPageIds.has(recipientId) || igPageIds.has(senderId);
      const platform: Platform = isIg ? "instagram" : "messenger";
      console.log(`[${platform === "instagram" ? "IG" : "FB"}] event sender=${senderId} recipient=${recipientId} via=${platform}`);
      await ingestMessagingEvent(event, platform);
    }
  }
}

async function processInstagramEvent(payload: any) {
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];
    for (const event of messaging) {
      if (!event.message) continue;
      console.log(`[IG] direct-object event sender=${event.sender?.id} recipient=${event.recipient?.id}`);
      await ingestMessagingEvent(event, "instagram");
    }
  }
}

async function ingestMessagingEvent(event: any, platform: Platform) {
  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  const message = event.message;
  if (!senderId || !recipientId || !message) return;

  const integration = await findIntegrationByPageId(recipientId, platform)
    || await findIntegrationByPageId(senderId, platform); // echo case
  const branchId = integration?.branch_id || await getFallbackBranchId();
  if (!branchId) {
    console.log(`[${platform}] no branch found, skipping`);
    return;
  }

  const isOutbound = message.is_echo === true;
  const contactId = isOutbound ? recipientId : senderId;
  const content = message.text || (message.attachments?.[0]?.type === "image" ? "[Image]" : "[Attachment]");
  const messageType = message.attachments?.[0]?.type || "text";
  const mediaUrl = message.attachments?.[0]?.payload?.url || null;

  if (message.mid) {
    const { data: existing } = await supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("platform_message_id", message.mid)
      .maybeSingle();
    if (existing) {
      console.log(`[${platform}] dedup hit mid=${message.mid}`);
      return;
    }
  }

  const { data: inserted, error } = await supabase
    .from("whatsapp_messages")
    .insert({
      branch_id: branchId,
      phone_number: contactId,
      contact_name: null,
      message_type: messageType,
      content,
      media_url: mediaUrl,
      direction: isOutbound ? "outbound" : "inbound",
      status: isOutbound ? "sent" : "received",
      platform: platform as any,
      platform_message_id: message.mid || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error(`[${platform}] insert failed:`, error.message);
    return;
  }
  console.log(`[${platform}] stored ${isOutbound ? "outbound" : "inbound"} msg id=${inserted?.id}`);

  if (!isOutbound && inserted) {
    await supabase.from("whatsapp_chat_settings").upsert(
      { branch_id: branchId, phone_number: contactId, is_unread: true, platform: platform as any },
      { onConflict: "branch_id,phone_number" }
    );
    await triggerAiReply(inserted.id, contactId, branchId, platform, integration);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function findIntegrationByPageId(pageId: string, integrationType: string) {
  const { data } = await supabase
    .from("integration_settings")
    .select("id, branch_id, config, credentials")
    .eq("integration_type", integrationType)
    .eq("is_active", true)
    .limit(20);
  if (!data) return null;
  return data.find((i: any) =>
    String(i.config?.page_id) === pageId ||
    String(i.config?.instagram_account_id) === pageId
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

async function triggerAiReply(
  messageId: string,
  senderId: string,
  branchId: string,
  platform: Platform,
  _integration?: any
) {
  console.log(`[AI:${platform}] start sender=${senderId} branch=${branchId}`);

  const { data: settings } = await supabase
    .from("whatsapp_chat_settings")
    .select("bot_active")
    .eq("branch_id", branchId)
    .eq("phone_number", senderId)
    .maybeSingle();
  if (settings?.bot_active === false) {
    console.log(`[AI:${platform}] bot_active=false, skipping`);
    return;
  }

  const orgConfig = await getOrgAiConfig();
  const aiConfig = orgConfig?.whatsapp_ai_config as any;
  if (!aiConfig?.auto_reply_enabled) {
    console.log(`[AI:${platform}] auto_reply_enabled=false`);
    return;
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.log(`[AI:${platform}] LOVABLE_API_KEY missing`);
    return;
  }

  const { data: memberMatch } = await supabase
    .from("members")
    .select("id, branch_id, profiles(full_name)")
    .or(`whatsapp_id.eq.${senderId}`)
    .maybeSingle()
    .then((r: any) => r, () => ({ data: null }));

  const memberId = memberMatch?.id || null;
  let membershipId: string | null = null;
  let planId: string | null = null;
  let memberName = "Guest";

  if (memberId) {
    memberName = (memberMatch as any).profiles?.full_name || "Member";
    const { data: ms } = await supabase
      .from("memberships")
      .select("id, plan_id")
      .eq("member_id", memberId)
      .eq("status", "active")
      .order("end_date", { ascending: false })
      .limit(1).maybeSingle();
    if (ms) { membershipId = ms.id; planId = ms.plan_id; }
  }

  // E3: cross-platform history (no platform filter) — tag each turn with platform
  const { data: recentMessages } = await supabase
    .from("whatsapp_messages")
    .select("content, direction, platform")
    .eq("phone_number", senderId)
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false })
    .limit(15);

  const history = (recentMessages || []).reverse().map((m: any) => ({
    role: (m.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
    content: `(via ${m.platform || "whatsapp"}) ${m.content || ""}`,
  }));

  const platformLabel = platform === "instagram" ? "Instagram DM" : platform === "messenger" ? "Facebook Messenger" : "WhatsApp";
  const gymName = orgConfig?.gym_name || "Incline Fitness";
  const customPrompt = aiConfig?.system_prompt || "";
  const baseRole = customPrompt || `You are a helpful gym assistant for "${gymName}".`;
  const systemPrompt = `${baseRole}\n\nYou are responding on ${platformLabel}. Conversation history may include messages from other channels (WhatsApp, IG, Messenger) — treat them as one continuous conversation. Keep replies short (1-3 sentences), warm, professional. Use tools when applicable.`;

  let tools: any[] | undefined = memberId ? getAllToolDefinitions() : undefined;
  if (tools) {
    try {
      const { data: orgRow } = await supabase.from("organization_settings").select("ai_tool_config").limit(1).maybeSingle();
      const cfg = (orgRow?.ai_tool_config as Record<string, boolean>) || {};
      tools = tools.filter((t: any) => cfg[t.function.name] !== false);
      if (tools.length === 0) tools = undefined;
    } catch (_e) { /* keep all */ }
  }

  const ctx = {
    isMember: !!memberId,
    memberId: memberId || undefined,
    memberName,
    branchId,
    membershipId: membershipId || undefined,
    planId: planId || undefined,
    contextPrompt: memberId ? `Member: ${memberName}` : "Speaking to a guest/lead.",
  };

  const messages: any[] = [
    { role: "system", content: `${systemPrompt}\n\n${ctx.contextPrompt}` },
    ...history,
  ];

  let aiResult: any;
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: aiConfig?.model || "google/gemini-2.5-flash",
        messages,
        ...(tools ? { tools, tool_choice: "auto" } : {}),
      }),
    });
    if (!resp.ok) {
      console.error(`[AI:${platform}] gateway error ${resp.status}`);
      return;
    }
    aiResult = await resp.json();
  } catch (e) {
    console.error(`[AI:${platform}] fetch failed:`, e);
    return;
  }

  const choice = aiResult?.choices?.[0];
  const toolCalls = choice?.message?.tool_calls;
  let replyText: string | null = choice?.message?.content || null;
  console.log(`[AI:${platform}] reply len=${replyText?.length || 0} toolCalls=${toolCalls?.length || 0}`);

  if (toolCalls?.length && tools) {
    const toolMessages: any[] = [];
    for (const tc of toolCalls) {
      let parsedArgs: any = {};
      try { parsedArgs = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
      const result = await executeSharedToolCall(
        supabase, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
        tc.function.name, parsedArgs, ctx, senderId, branchId, platform,
      );
      toolMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
    }
    try {
      const followup = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: aiConfig?.model || "google/gemini-2.5-flash",
          messages: [...messages, choice.message, ...toolMessages],
        }),
      });
      const followupData = await followup.json();
      replyText = followupData?.choices?.[0]?.message?.content || replyText;
    } catch (e) {
      console.error(`[AI:${platform}] follow-up failed:`, e);
    }
  }

  if (!replyText) return;

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

  if (!replyMsg) return;

  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        message_id: replyMsg.id,
        recipient_id: senderId,
        content: replyText,
        branch_id: branchId,
        platform,
      }),
    });
  } catch (sendErr) {
    console.error(`[AI:${platform}] send reply failed:`, sendErr);
  }
}
