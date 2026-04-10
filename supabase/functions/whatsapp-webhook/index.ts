// v3.0.0 — AI Brain: context hydration, structured lead extraction, tool calling scaffold
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
let fallbackBranchIdCache: string | null | undefined;

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

// ─── Verification ──────────────────────────────────────────────────────────────

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

    return new Response(
      JSON.stringify({ error: "Invalid verification request", expected_mode: "subscribe", received_mode: modeRaw, missing_params: missingParams }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
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

  return new Response(challenge, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
}

function getQueryParam(url: URL, keys: string[]) {
  for (const key of keys) {
    const value = url.searchParams.get(key)?.trim();
    if (value) return value;
  }
  return null;
}

// ─── Event Handling ────────────────────────────────────────────────────────────

async function handleEvent(req: Request) {
  const bodyText = await req.text();
  let payload: any;
  try {
    payload = JSON.parse(bodyText);
  } catch {
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

  // Signature verification
  const phoneNumberIds = extractPhoneNumberIds(payload);
  const candidateIntegrations = await Promise.all(phoneNumberIds.map((id) => findIntegrationByPhoneNumberId(id)));
  const signatureSecrets: string[] = Array.from(
    new Set(
      candidateIntegrations
        .map(getWebhookSignatureSecret)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );

  if (signatureSecrets.length > 0) {
    const signatureHeader = req.headers.get("x-hub-signature-256") ?? req.headers.get("x-hub-signature");
    if (!signatureHeader) {
      return new Response(JSON.stringify({ error: "Missing webhook signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const isValidSignature = await verifyWebhookSignature(bodyText, signatureHeader, signatureSecrets);
    if (!isValidSignature) {
      return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  if (entries.length === 0) {
    return new Response(JSON.stringify({ status: "ignored" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  for (const entry of entries) {
    if (!Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      const value = change?.value;
      const field = change?.field;

      // Handle template status updates
      if (field === "message_template_status_update") {
        await processTemplateStatusUpdate(value);
        continue;
      }

      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const integration = await findIntegrationByPhoneNumberId(String(phoneNumberId));
      const resolvedBranchId = await resolveBranchId(integration, value);
      if (!resolvedBranchId) {
        console.warn("Unable to resolve branch_id for WhatsApp webhook event", phoneNumberId);
      }

      const insertedMessageIds = await processIncomingMessages(value, resolvedBranchId);
      await processStatusUpdates(value, resolvedBranchId);

      // Trigger AI auto-reply for each inbound message
      if (insertedMessageIds.length > 0 && resolvedBranchId) {
        for (const { id: msgId, phone_number } of insertedMessageIds) {
          try {
            await triggerAiAutoReply(msgId, phone_number, resolvedBranchId);
          } catch (err) {
            console.error("AI auto-reply error (non-blocking):", err);
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Template Status Updates ───────────────────────────────────────────────────

async function processTemplateStatusUpdate(value: any) {
  if (!value) return;
  const templateName = value.message_template_name;
  const templateStatus = value.event;
  const reason = value.reason || value.rejected_reason || null;

  if (!templateName || !templateStatus) return;

  const { error } = await supabase
    .from("whatsapp_templates")
    .update({
      status: templateStatus,
      rejected_reason: reason,
      synced_at: new Date().toISOString(),
    })
    .eq("name", templateName);

  if (error) {
    console.error("Failed to update whatsapp_templates status:", error);
  }

  await supabase
    .from("templates")
    .update({
      meta_template_status: templateStatus,
      meta_rejection_reason: reason,
    })
    .eq("meta_template_name", templateName)
    .not("meta_template_name", "is", null);
}

// ─── Incoming Messages ─────────────────────────────────────────────────────────

async function processIncomingMessages(value: any, branchId: string | null): Promise<{ id: string; phone_number: string }[]> {
  if (!branchId) return [];

  const messages = Array.isArray(value.messages) ? value.messages : [];
  const contactName = value.contacts?.[0]?.profile?.name ?? null;
  const insertedItems: { id: string; phone_number: string }[] = [];

  for (const message of messages) {
    if (!message?.from || !message?.id) continue;

    const { data: existing } = await supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("whatsapp_message_id", message.id)
      .maybeSingle();

    if (existing) continue;

    const msgPayload = {
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

    const { data, error } = await supabase.from("whatsapp_messages").insert(msgPayload).select("id").single();
    if (error) {
      console.error("Failed to insert WhatsApp inbound message", error);
    } else if (data) {
      insertedItems.push({ id: data.id, phone_number: message.from });
    }
  }

  return insertedItems;
}

// ─── Status Updates ────────────────────────────────────────────────────────────

async function processStatusUpdates(value: any, branchId: string | null) {
  const statuses = Array.isArray(value.statuses) ? value.statuses : [];

  for (const status of statuses) {
    if (!status?.id) continue;

    let updateQuery = supabase
      .from("whatsapp_messages")
      .update({ status: status.status ?? "sent", updated_at: new Date().toISOString() })
      .eq("whatsapp_message_id", status.id);

    if (branchId) {
      updateQuery = updateQuery.eq("branch_id", branchId);
    }

    const { error } = await updateQuery;
    if (error) {
      console.error("Failed to update WhatsApp message status", error);
    }
  }
}

// ─── Context Hydration (Epic 2) ────────────────────────────────────────────────

async function hydrateContactContext(phoneNumber: string): Promise<{ isMember: boolean; contextPrompt: string; memberName?: string }> {
  const cleanPhone = phoneNumber.replace(/[\s\-\+]/g, "");
  const phoneVariants = [cleanPhone, `+${cleanPhone}`, cleanPhone.replace(/^91/, "+91")];

  // Check if member
  for (const variant of phoneVariants) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("phone", variant)
      .limit(1)
      .maybeSingle();

    if (profile) {
      // Get member + membership info
      const { data: member } = await supabase
        .from("members")
        .select("id, member_code")
        .eq("user_id", profile.id)
        .limit(1)
        .maybeSingle();

      if (member) {
        const { data: memberships } = await supabase
          .from("memberships")
          .select("id, status, end_date, plan_id, membership_plans(name)")
          .eq("member_id", member.id)
          .eq("status", "active")
          .limit(1);

        const activeMembership = memberships?.[0];
        let contextLines = `Context: Speaking to ${profile.full_name || "a member"}, an Active Member (Code: ${member.member_code}).`;
        if (activeMembership) {
          const planName = (activeMembership as any).membership_plans?.name || "Unknown Plan";
          const daysLeft = activeMembership.end_date
            ? Math.max(0, Math.ceil((new Date(activeMembership.end_date).getTime() - Date.now()) / 86400000))
            : "N/A";
          contextLines += ` Plan: ${planName}, ${daysLeft} days remaining.`;
        }
        return { isMember: true, contextPrompt: contextLines, memberName: profile.full_name || undefined };
      }
    }
  }

  // Check if existing lead
  for (const variant of phoneVariants) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id, full_name, status, temperature")
      .eq("phone", variant)
      .limit(1)
      .maybeSingle();

    if (lead) {
      return {
        isMember: false,
        contextPrompt: `Context: Speaking to ${lead.full_name || "a known lead"} (Lead status: ${lead.status}, Temperature: ${lead.temperature}).`,
      };
    }
  }

  return { isMember: false, contextPrompt: "Context: Speaking to an unregistered contact (potential new lead)." };
}

// ─── AI Auto-Reply with Brain (Epics 2-4) ──────────────────────────────────────

async function computeAppSecretProof(accessToken: string, appSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(accessToken));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function triggerAiAutoReply(messageId: string, phoneNumber: string, branchId: string) {
  // Check org settings for AI auto-reply config
  const { data: orgSettings } = await supabase
    .from("organization_settings")
    .select("whatsapp_ai_config")
    .limit(1)
    .maybeSingle();

  const aiConfig = orgSettings?.whatsapp_ai_config as any;
  if (!aiConfig?.auto_reply_enabled) return;

  // Check bot_active status for this contact
  const { data: chatSettings } = await supabase
    .from("whatsapp_chat_settings")
    .select("bot_active")
    .eq("branch_id", branchId)
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  // If explicitly paused, skip auto-reply
  if (chatSettings && chatSettings.bot_active === false) return;

  // Get the inbound message
  const { data: inboundMsg } = await supabase
    .from("whatsapp_messages")
    .select("phone_number, contact_name, content")
    .eq("id", messageId)
    .single();

  if (!inboundMsg?.content) return;

  // Optional delay
  const delaySeconds = aiConfig.reply_delay_seconds || 0;
  if (delaySeconds > 0 && delaySeconds <= 30) {
    await new Promise((r) => setTimeout(r, delaySeconds * 1000));
  }

  // ── Epic 2: Context Hydration ──
  const contactContext = await hydrateContactContext(phoneNumber);

  // ── Epic 3: Lead Capture Config ──
  const leadCaptureConfig = aiConfig.lead_capture as {
    enabled?: boolean;
    target_fields?: string[];
    handoff_message?: string;
  } | undefined;

  // Fetch recent conversation history
  const { data: recentMsgs } = await supabase
    .from("whatsapp_messages")
    .select("content, direction")
    .eq("phone_number", inboundMsg.phone_number)
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false })
    .limit(10);

  const conversationHistory = (recentMsgs || [])
    .reverse()
    .map((m: any) => ({
      role: m.direction === "inbound" ? "user" as const : "assistant" as const,
      content: m.content || "",
    }));

  // Build system prompt
  let systemPrompt = aiConfig.system_prompt ||
    "You are a helpful gym assistant. Answer questions about membership, timings, and facilities. Keep responses short and friendly.";

  // Inject context
  systemPrompt = `${contactContext.contextPrompt}\n\n${systemPrompt}`;

  // Epic 3: Inject lead capture instructions for non-members
  const shouldCaptureLead = !contactContext.isMember && leadCaptureConfig?.enabled && (leadCaptureConfig.target_fields?.length ?? 0) > 0;
  if (shouldCaptureLead) {
    const fieldLabels: Record<string, string> = {
      name: "Full Name", phone: "Phone Number", email: "Email", goal: "Fitness Goal",
      budget: "Budget", start_date: "Expected Start Date", experience: "Fitness Experience",
      preferred_time: "Preferred Time",
    };
    const fieldNames = (leadCaptureConfig!.target_fields || []).map(f => fieldLabels[f] || f).join(", ");
    systemPrompt += `\n\nIMPORTANT LEAD CAPTURE INSTRUCTIONS:
You are also a lead generation assistant. Your secondary goal is to naturally collect the following information from this person during the conversation: ${fieldNames}.
- Ask for these naturally, one or two at a time, weaving them into the conversation.
- Do NOT ask for all fields at once.
- Once you have collected ALL the required fields, respond with ONLY this exact JSON (no other text):
{"status":"lead_captured","data":{${(leadCaptureConfig!.target_fields || []).map(f => `"${f}":"..."`).join(",")}}}
- The phone number is already known: ${phoneNumber}
- Until all fields are collected, continue the normal helpful conversation.`;
  }

  // Call Lovable AI Gateway
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not set — skipping AI auto-reply");
    return;
  }

  // Build messages array
  const aiMessages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
  ];

  // Epic 4: Tool calling for members
  const tools = contactContext.isMember ? [
    {
      type: "function",
      function: {
        name: "get_schedule",
        description: "Get available schedule/classes for a given date and type",
        parameters: {
          type: "object",
          properties: {
            date: { type: "string", description: "Date in YYYY-MM-DD format" },
            type: { type: "string", description: "Type of schedule: class, pt_session, facility" },
          },
          required: ["date"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "book_session",
        description: "Book a session for the member",
        parameters: {
          type: "object",
          properties: {
            type: { type: "string", description: "Type: class, pt_session, facility" },
            datetime: { type: "string", description: "ISO datetime for the booking" },
          },
          required: ["type", "datetime"],
        },
      },
    },
  ] : undefined;

  const aiRequestBody: any = {
    model: "google/gemini-3-flash-preview",
    messages: aiMessages,
  };
  if (tools) {
    aiRequestBody.tools = tools;
  }

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(aiRequestBody),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error("AI gateway error for auto-reply:", aiResponse.status, errText);
    return;
  }

  const aiResult = await aiResponse.json();
  const choice = aiResult.choices?.[0];

  // Epic 4: Handle tool calls (mocked for now)
  if (choice?.message?.tool_calls?.length > 0) {
    const toolCalls = choice.message.tool_calls;
    console.log("AI requested tool calls:", JSON.stringify(toolCalls));

    // Build mocked tool responses
    const toolMessages = toolCalls.map((tc: any) => ({
      role: "tool",
      tool_call_id: tc.id,
      content: JSON.stringify({
        success: true,
        message: `${tc.function.name} is not yet wired up. Feature coming soon!`,
        data: [],
      }),
    }));

    // Follow-up call with mocked responses
    const followUpResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          ...aiMessages,
          choice.message,
          ...toolMessages,
        ],
        tools,
      }),
    });

    if (followUpResponse.ok) {
      const followUpResult = await followUpResponse.json();
      const followUpText = followUpResult.choices?.[0]?.message?.content;
      if (followUpText) {
        await sendAiReply(followUpText, inboundMsg, branchId);
      }
    }
    return;
  }

  let replyText = choice?.message?.content;
  if (!replyText) return;

  // Epic 3: Check for lead_captured JSON
  if (shouldCaptureLead) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = replyText.match(/\{[\s\S]*"status"\s*:\s*"lead_captured"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.status === "lead_captured" && parsed.data) {
          console.log("AI captured lead data:", JSON.stringify(parsed.data));

          // Insert into leads table
          const leadData: any = {
            phone: phoneNumber,
            source: "whatsapp_ai",
            branch_id: branchId,
            status: "new",
            temperature: "warm",
            score: 50,
            full_name: parsed.data.name || parsed.data.full_name || inboundMsg.contact_name || "WhatsApp Lead",
            email: parsed.data.email || null,
            goals: parsed.data.goal || parsed.data.fitness_goal || null,
            budget: parsed.data.budget || null,
            fitness_goal: parsed.data.fitness_goal || parsed.data.goal || null,
            expected_start_date: parsed.data.expected_start_date || parsed.data.start_date || null,
            fitness_experience: parsed.data.fitness_experience || parsed.data.experience || null,
            preferred_time: parsed.data.preferred_time || null,
            notes: `AI-captured via WhatsApp conversation`,
          };

          const { data: newLead, error: leadError } = await supabase
            .from("leads")
            .insert(leadData)
            .select("id")
            .single();

          if (leadError) {
            console.error("Failed to insert AI-captured lead:", leadError);
          } else if (newLead) {
            // Insert marker message
            await supabase.from("whatsapp_messages").insert({
              branch_id: branchId,
              phone_number: inboundMsg.phone_number,
              contact_name: inboundMsg.contact_name,
              content: `[AI_LEAD_CAPTURED:${newLead.id}]`,
              direction: "outbound",
              status: "delivered",
              message_type: "text",
            });

            // Set bot_active = false
            await supabase.from("whatsapp_chat_settings").upsert(
              {
                branch_id: branchId,
                phone_number: phoneNumber,
                bot_active: false,
                paused_at: new Date().toISOString(),
              },
              { onConflict: "branch_id,phone_number" },
            );
          }

          // Send handoff message
          const handoffMessage = leadCaptureConfig?.handoff_message || "Thanks for sharing! Our team will reach out to you shortly. 💪";
          await sendAiReply(handoffMessage, inboundMsg, branchId);
          return;
        }
      }
    } catch (parseErr) {
      // Not a lead capture JSON — continue with normal reply
      console.log("AI response is not lead_captured JSON, sending as normal reply");
    }
  }

  // Normal AI reply
  await sendAiReply(replyText, inboundMsg, branchId);
}

// ─── Send AI Reply via Meta API ────────────────────────────────────────────────

async function sendAiReply(
  replyText: string,
  inboundMsg: { phone_number: string; contact_name: string | null },
  branchId: string,
) {
  // Insert AI reply as outbound message
  const { data: aiMsg, error: insertErr } = await supabase
    .from("whatsapp_messages")
    .insert({
      branch_id: branchId,
      phone_number: inboundMsg.phone_number,
      contact_name: inboundMsg.contact_name,
      content: replyText,
      direction: "outbound",
      status: "pending",
      message_type: "text",
    })
    .select("id")
    .single();

  if (insertErr || !aiMsg) {
    console.error("Failed to insert AI auto-reply message", insertErr);
    return;
  }

  // Send via Meta API directly with appsecret_proof
  const integration = await getWhatsAppIntegration(branchId);
  if (!integration) return;

  const accessToken = integration.credentials?.access_token as string;
  const phoneNumberId = integration.config?.phone_number_id as string;
  const appSecret = (integration.credentials?.app_secret as string) || null;
  if (!accessToken || !phoneNumberId) return;

  const cleanPhone = inboundMsg.phone_number.replace(/[\s\-\+]/g, "");

  // Compute appsecret_proof
  let metaUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  if (appSecret) {
    const proof = await computeAppSecretProof(accessToken, appSecret);
    metaUrl += `?appsecret_proof=${proof}`;
  }

  const metaResponse = await fetch(metaUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: cleanPhone,
      type: "text",
      text: { body: replyText },
    }),
  });

  const metaData = await metaResponse.json();

  if (metaResponse.ok) {
    await supabase
      .from("whatsapp_messages")
      .update({
        status: "sent",
        whatsapp_message_id: metaData?.messages?.[0]?.id || null,
      })
      .eq("id", aiMsg.id);
  } else {
    console.error("AI auto-reply Meta send failed:", JSON.stringify(metaData));
    await supabase.from("whatsapp_messages").update({ status: "failed" }).eq("id", aiMsg.id);
  }
}

async function getWhatsAppIntegration(branchId: string): Promise<WhatsAppIntegration | null> {
  const { data: branchInt } = await supabase
    .from("integration_settings")
    .select("id, branch_id, config, credentials")
    .eq("branch_id", branchId)
    .eq("integration_type", "whatsapp")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (branchInt) return branchInt as WhatsAppIntegration;

  const { data: globalInt } = await supabase
    .from("integration_settings")
    .select("id, branch_id, config, credentials")
    .is("branch_id", null)
    .eq("integration_type", "whatsapp")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return (globalInt as WhatsAppIntegration) || null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

  if (error) console.error("Error fetching integration for webhook", error);

  const result = (data as WhatsAppIntegration | null) ?? null;
  integrationCache.set(phoneNumberId, result);
  return result;
}

async function resolveBranchId(integration: WhatsAppIntegration | null, value: any): Promise<string | null> {
  if (!integration) return null;
  if (integration.branch_id) return integration.branch_id;

  const configuredDefaultBranch = integration.config?.default_branch_id;
  if (typeof configuredDefaultBranch === "string" && configuredDefaultBranch.trim().length > 0) {
    return configuredDefaultBranch.trim();
  }

  const firstStatusId = Array.isArray(value?.statuses) ? value.statuses?.[0]?.id : null;
  if (typeof firstStatusId === "string" && firstStatusId.trim().length > 0) {
    const { data: statusMsg } = await supabase
      .from("whatsapp_messages")
      .select("branch_id")
      .eq("whatsapp_message_id", firstStatusId)
      .not("branch_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (statusMsg?.branch_id) return statusMsg.branch_id;
  }

  const inboundPhone = Array.isArray(value?.messages) ? value.messages?.[0]?.from : null;
  if (typeof inboundPhone === "string" && inboundPhone.trim().length > 0) {
    const { data: lastConversation } = await supabase
      .from("whatsapp_messages")
      .select("branch_id")
      .eq("phone_number", inboundPhone)
      .not("branch_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastConversation?.branch_id) return lastConversation.branch_id;
  }

  return await getFallbackBranchId();
}

async function getFallbackBranchId(): Promise<string | null> {
  if (fallbackBranchIdCache !== undefined) {
    return fallbackBranchIdCache;
  }

  const { data: branch } = await supabase
    .from("branches")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  fallbackBranchIdCache = branch?.id ?? null;
  return fallbackBranchIdCache;
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
    if (computed === expectedSignature) return true;
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
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
