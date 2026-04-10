// v2.0.1 — inbound branch fallback for global WhatsApp integrations
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

// ─── AI Auto-Reply ─────────────────────────────────────────────────────────────

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
    .select("bot_active, lead_captured")
    .eq("branch_id", branchId)
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  // If explicitly paused or lead already captured, skip auto-reply
  if (chatSettings && chatSettings.bot_active === false) return;
  if (chatSettings && chatSettings.lead_captured === true) return;

  // Get the inbound message (including member_id for context hydration)
  const { data: inboundMsg } = await supabase
    .from("whatsapp_messages")
    .select("phone_number, contact_name, content, member_id")
    .eq("id", messageId)
    .single();

  if (!inboundMsg?.content) return;

  // ── Epic 2: Context Hydration ────────────────────────────────────────────────
  let contactContextPrefix = "Context: You are speaking to an unregistered Lead.";

  if (inboundMsg.member_id) {
    // Fetch member record
    const { data: member } = await supabase
      .from("members")
      .select("status")
      .eq("id", inboundMsg.member_id)
      .maybeSingle();

    if (member) {
      // Fetch active memberships with plan name
      const { data: memberships } = await supabase
        .from("memberships")
        .select("id, membership_plans(name), end_date, status")
        .eq("member_id", inboundMsg.member_id)
        .eq("status", "active")
        .limit(3);

      // Fetch remaining benefit credits
      const { data: credits } = await supabase
        .from("member_benefit_credits")
        .select("benefit_type, credits_remaining")
        .eq("member_id", inboundMsg.member_id)
        .gt("credits_remaining", 0)
        .gt("expires_at", new Date().toISOString())
        .limit(10);

      const memberName = inboundMsg.contact_name || "Valued Member";
      const planNames = (memberships || [])
        .map((m: any) => m.membership_plans?.name)
        .filter(Boolean)
        .join(", ");
      const creditSummary = (credits || [])
        .map((c: any) => `${c.credits_remaining} ${c.benefit_type}`)
        .join(", ");

      contactContextPrefix =
        `Context: You are speaking to ${memberName}, an Active Member.` +
        (planNames ? ` They are on the ${planNames} plan.` : "") +
        (creditSummary ? ` They have ${creditSummary} remaining benefit credits.` : "");
    }
  }

  // ── Epic 1 + 3: Fetch AI Flow Config & Build Lead Capture Prompt ─────────────
  let leadCaptureInstructions = "";
  let aiFlowConfig: { target_fields?: string[]; handoff_message?: string } | null = null;

  const { data: flowConfigRecord } = await supabase
    .from("integration_settings")
    .select("config")
    .eq("integration_type", "ai_flow")
    .eq("provider", "whatsapp_lead")
    .eq("is_active", true)
    .maybeSingle();

  if (flowConfigRecord?.config) {
    aiFlowConfig = flowConfigRecord.config as { target_fields?: string[]; handoff_message?: string };
    const targetFields = aiFlowConfig?.target_fields || [];
    if (targetFields.length > 0 && !inboundMsg.member_id) {
      // Build a JSON example using only the configured fields
      const exampleData = targetFields.reduce<Record<string, string>>((acc, field) => {
        acc[field] = `<${field}_value>`;
        return acc;
      }, {});
      const exampleJson = JSON.stringify({ status: "lead_captured", data: exampleData });

      // Only inject lead capture instructions for non-members
      leadCaptureInstructions = `

LEAD CAPTURE INSTRUCTIONS:
You are a lead generation assistant. Your goal is to naturally and conversationally collect the user's: ${targetFields.join(", ")}.
Ask for one piece of information at a time in a friendly, natural way.
ONCE you have collected ALL of the required fields, stop chatting and output ONLY this strict JSON (nothing else, no markdown, no code block):
${exampleJson}`;
    }
  }

  // ── Epic 4: Gemini Function Declarations (Tool Calling) ──────────────────────
  const tools = [
    {
      type: "function",
      function: {
        name: "get_schedule",
        description: "Retrieve available class or session schedule for a given date and type",
        parameters: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: "The date to check schedule for (YYYY-MM-DD format)",
            },
            type: {
              type: "string",
              enum: ["yoga", "zumba", "strength", "cardio", "pt_session", "any"],
              description: "The type of class or session",
            },
          },
          required: ["date", "type"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "book_session",
        description: "Book a fitness class or PT session for the member",
        parameters: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "The member's user ID",
            },
            type: {
              type: "string",
              description: "The type of session to book",
            },
            datetime: {
              type: "string",
              description: "The date and time of the session in ISO 8601 format",
            },
          },
          required: ["user_id", "type", "datetime"],
        },
      },
    },
  ];

  // Optional delay
  const delaySeconds = aiConfig.reply_delay_seconds || 0;
  if (delaySeconds > 0 && delaySeconds <= 30) {
    await new Promise((r) => setTimeout(r, delaySeconds * 1000));
  }

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
    .map((m: any) => `${m.direction === "inbound" ? inboundMsg.contact_name || "Customer" : "Assistant"}: ${m.content}`)
    .join("\n");

  const basePrompt = aiConfig.system_prompt ||
    'You are a helpful gym assistant. Answer questions about membership, timings, and facilities. Keep responses short and friendly.';

  const systemPrompt = `${contactContextPrefix}\n\n${basePrompt}${leadCaptureInstructions}`;

  // Call Lovable AI Gateway
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not set — skipping AI auto-reply");
    return;
  }

  const requestBody: Record<string, unknown> = {
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Conversation:\n${conversationHistory}\n\nReply to the customer's last message concisely.` },
    ],
  };

  // Only inject tools for active members (function calling for bookings)
  if (inboundMsg.member_id) {
    requestBody.tools = tools;
    requestBody.tool_choice = "auto";
  }

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!aiResponse.ok) {
    console.error("AI gateway error for auto-reply:", aiResponse.status);
    return;
  }

  const aiResult = await aiResponse.json();
  const aiMessage = aiResult.choices?.[0]?.message;

  // ── Epic 4: Handle Tool/Function Calls ───────────────────────────────────────
  if (aiMessage?.tool_calls && aiMessage.tool_calls.length > 0) {
    const toolCall = aiMessage.tool_calls[0];
    const functionName = toolCall?.function?.name;
    let mockedResult: unknown;

    switch (functionName) {
      case "get_schedule":
        mockedResult = {
          available_slots: [
            { time: "07:00 AM", instructor: "Priya", spots_left: 5 },
            { time: "06:00 PM", instructor: "Rahul", spots_left: 3 },
          ],
          date: JSON.parse(toolCall.function.arguments || "{}").date,
          type: JSON.parse(toolCall.function.arguments || "{}").type,
        };
        break;
      case "book_session":
        mockedResult = {
          success: true,
          booking_id: `MOCK-${Date.now()}`,
          message: "Session booked successfully (demo mode)",
        };
        break;
      default:
        mockedResult = { error: "Unknown function" };
    }

    // Send mocked tool result back to Gemini to complete conversation loop
    const followUpBody = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Conversation:\n${conversationHistory}\n\nReply to the customer's last message concisely.` },
        { role: "assistant", content: null, tool_calls: aiMessage.tool_calls },
        {
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(mockedResult),
        },
      ],
    };

    const followUpResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(followUpBody),
    });

    if (!followUpResponse.ok) {
      console.error("AI follow-up error after tool call:", followUpResponse.status);
      return;
    }

    const followUpResult = await followUpResponse.json();
    const finalReplyText = followUpResult.choices?.[0]?.message?.content;
    if (!finalReplyText) return;

    await sendWhatsAppReply(branchId, inboundMsg, finalReplyText);
    return;
  }

  const replyText = aiMessage?.content;
  if (!replyText) return;

  // ── Epic 3: Detect Lead Captured JSON ────────────────────────────────────────
  const trimmedReply = replyText.trim();
  let leadCapturedData: Record<string, string> | null = null;

  try {
    // Try to parse the entire response as JSON first
    const parsed = JSON.parse(trimmedReply);
    if (parsed?.status === "lead_captured" && parsed?.data) {
      leadCapturedData = parsed.data;
    }
  } catch {
    // Try to extract JSON from within the text (model may wrap with markdown)
    const jsonMatch = trimmedReply.match(/\{[\s\S]*"status"\s*:\s*"lead_captured"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed?.status === "lead_captured" && parsed?.data) {
          leadCapturedData = parsed.data;
        }
      } catch {
        // Not a valid lead capture JSON
      }
    }
  }

  if (leadCapturedData) {
    // Insert lead into CRM
    const leadName = leadCapturedData.name || inboundMsg.contact_name || "WhatsApp Lead";
    const leadPhone = leadCapturedData.phone || inboundMsg.phone_number;

    const { data: newLead, error: leadInsertErr } = await supabase
      .from("leads")
      .insert({
        branch_id: branchId,
        full_name: leadName,
        phone: leadPhone,
        email: leadCapturedData.email || null,
        goals: leadCapturedData.fitness_goal || null,
        budget: leadCapturedData.budget || null,
        notes: [
          leadCapturedData.health_conditions ? `Health: ${leadCapturedData.health_conditions}` : null,
          leadCapturedData.referral_source ? `Source: ${leadCapturedData.referral_source}` : null,
          leadCapturedData.age ? `Age: ${leadCapturedData.age}` : null,
          leadCapturedData.gender ? `Gender: ${leadCapturedData.gender}` : null,
          leadCapturedData.expected_start_date ? `Start Date: ${leadCapturedData.expected_start_date}` : null,
        ]
          .filter(Boolean)
          .join("\n") || null,
        source: "whatsapp",
        status: "new",
        temperature: "warm",
        preferred_contact_channel: "whatsapp",
        tags: ["ai_captured"],
      })
      .select("id")
      .single();

    if (leadInsertErr) {
      console.error("Failed to insert AI-captured lead:", leadInsertErr);
    } else if (newLead) {
      // Mark chat as lead captured and pause bot
      const chatUpsertPayload = {
        branch_id: branchId,
        phone_number: phoneNumber,
        bot_active: false,
        lead_captured: true,
        captured_lead_id: newLead.id,
        paused_at: new Date().toISOString(),
      };
      await supabase
        .from("whatsapp_chat_settings")
        .upsert(chatUpsertPayload, { onConflict: "branch_id,phone_number" });
    }

    // Send handoff message
    const handoffMessage =
      aiFlowConfig?.handoff_message ||
      "Thanks! 🙏 Our team has your details and will reach out to you shortly!";
    await sendWhatsAppReply(branchId, inboundMsg, handoffMessage);
    return;
  }

  // Standard text reply
  await sendWhatsAppReply(branchId, inboundMsg, replyText);
}

// Helper: insert message row + send via Meta API
async function sendWhatsAppReply(
  branchId: string,
  inboundMsg: { phone_number: string; contact_name: string | null; member_id?: string | null },
  replyText: string,
) {
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
