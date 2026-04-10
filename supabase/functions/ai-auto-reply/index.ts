import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')

// Service-role client used for autonomous (non-user) operations
const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ─── Mocked tool executor (Epic 4) ──────────────────────────────────────────

function executeMockedTool(name: string, args: Record<string, string>): string {
  if (name === 'get_schedule') {
    return JSON.stringify({
      available_slots: [
        { time: '09:00', instructor: 'Priya', spots_left: 5 },
        { time: '11:00', instructor: 'Rahul', spots_left: 3 },
        { time: '18:00', instructor: 'Amit', spots_left: 8 },
      ],
      date: args.date,
      type: args.type,
    })
  }
  if (name === 'book_session') {
    return JSON.stringify({
      success: true,
      booking_id: `BK-${Math.floor(Math.random() * 100000)}`,
      message: `Session booked for ${args.datetime}`,
    })
  }
  return JSON.stringify({ error: 'Unknown tool' })
}

// ─── Context hydration helper (Epic 2) ──────────────────────────────────────

async function hydrateContactContext(phoneNumber: string): Promise<string> {
  // Normalise phone: strip non-digit chars except leading +
  const normalised = phoneNumber.replace(/[\s\-()]/g, '')

  // Look up profiles by phone
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, full_name, phone')
    .or(`phone.eq.${normalised},phone.eq.${phoneNumber}`)
    .maybeSingle()

  if (!profile) {
    return 'Context: You are speaking to an unregistered Lead. Your goal is to collect their details.'
  }

  // Find member record
  const { data: member } = await serviceClient
    .from('members')
    .select('id, status')
    .eq('user_id', profile.id)
    .maybeSingle()

  if (!member) {
    return `Context: You are speaking to ${profile.full_name ?? 'a contact'} who is registered but not yet an active member.`
  }

  // Fetch active memberships
  const today = new Date().toISOString().split('T')[0]
  const { data: memberships } = await serviceClient
    .from('memberships')
    .select('status, end_date, plan_id')
    .eq('member_id', member.id)
    .eq('status', 'active')
    .gte('end_date', today)
    .order('end_date', { ascending: false })
    .limit(3)

  const membershipSummary =
    memberships && memberships.length > 0
      ? `Active membership(s): ${memberships.map((m) => `expires ${m.end_date}`).join(', ')}.`
      : 'No currently active membership.'

  return `Context: You are speaking to ${profile.full_name ?? 'a member'}, an existing Member. ${membershipSummary} Greet them warmly by name.`
}

// ─── AI Flow config helper (Epic 3) ─────────────────────────────────────────

interface AiFlowConfig {
  target_fields: string[]
  handoff_message: string
}

async function getAiFlowConfig(): Promise<AiFlowConfig | null> {
  const { data } = await serviceClient
    .from('integration_settings')
    .select('config, is_active')
    .eq('integration_type', 'ai_flow')
    .eq('provider', 'whatsapp_lead')
    .maybeSingle()

  if (!data?.is_active || !data.config) return null
  const c = data.config as Record<string, unknown>
  return {
    target_fields: (c.target_fields as string[]) ?? [],
    handoff_message:
      (c.handoff_message as string) ?? "Thanks! Our team will reach out shortly.",
  }
}

// ─── Lead capture helper (Epic 3) ───────────────────────────────────────────

interface CapturedLeadData {
  name?: string
  phone?: string
  email?: string
  fitness_goal?: string
  expected_start_date?: string
  budget?: string
  [key: string]: string | undefined
}

async function captureLead(
  branchId: string,
  phoneNumber: string,
  data: CapturedLeadData,
  handoffMessage: string
): Promise<string> {
  // Upsert lead record
  const leadPayload = {
    branch_id: branchId,
    full_name: data.name ?? data.phone ?? phoneNumber,
    phone: data.phone ?? phoneNumber,
    email: data.email ?? null,
    source: 'whatsapp_ai',
    notes: [
      data.fitness_goal ? `Goal: ${data.fitness_goal}` : null,
      data.expected_start_date ? `Start: ${data.expected_start_date}` : null,
      data.budget ? `Budget: ${data.budget}` : null,
    ]
      .filter(Boolean)
      .join(' | ') || null,
    status: 'new' as const,
  }

  const { data: lead, error: leadErr } = await serviceClient
    .from('leads')
    .insert(leadPayload)
    .select('id')
    .single()

  if (leadErr) {
    console.error('Failed to insert lead', leadErr)
  }

  // Update whatsapp_chats: bot_active = false, lead_captured = true
  await serviceClient
    .from('whatsapp_chats')
    .upsert(
      {
        branch_id: branchId,
        phone_number: phoneNumber,
        bot_active: false,
        lead_captured: true,
        captured_lead_id: lead?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'branch_id,phone_number' }
    )

  // Send handoff message via send-whatsapp function
  try {
    const tempMsgId = crypto.randomUUID()
    // Insert an outbound message row first
    const { data: msgRow } = await serviceClient
      .from('whatsapp_messages')
      .insert({
        branch_id: branchId,
        phone_number: phoneNumber,
        content: handoffMessage,
        direction: 'outbound',
        status: 'pending',
        message_type: 'text',
        sent_by: 'ai_bot',
      })
      .select('id')
      .single()

    if (msgRow?.id) {
      await serviceClient.functions.invoke('send-whatsapp', {
        body: {
          message_id: msgRow.id,
          phone_number: phoneNumber,
          content: handoffMessage,
          branch_id: branchId,
        },
      })
    }
  } catch (err) {
    console.warn('Failed to send handoff message', err)
  }

  return handoffMessage
}

// ─── Call Gemini via Lovable gateway (OpenAI-compatible format) ─────────────

interface ConvMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  name?: string
}

interface ToolCallResult {
  text?: string
  toolCall?: { id: string; name: string; args: Record<string, string> }
}

async function callGemini(
  systemPrompt: string,
  messages: ConvMessage[],
  enableTools: boolean
): Promise<ToolCallResult> {
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured')

  // OpenAI-compatible tools format (function calling)
  const openAITools = enableTools
    ? [
        {
          type: 'function',
          function: {
            name: 'get_schedule',
            description: 'Retrieve available class or PT session slots for a given date and type.',
            parameters: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
                type: { type: 'string', description: 'Session type: "class" or "pt"' },
              },
              required: ['date', 'type'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'book_session',
            description: 'Book a class or PT session for a member.',
            parameters: {
              type: 'object',
              properties: {
                user_id: { type: 'string', description: 'Member UUID' },
                type: { type: 'string', description: 'Session type: "class" or "pt"' },
                datetime: { type: 'string', description: 'ISO datetime of the session' },
              },
              required: ['user_id', 'type', 'datetime'],
            },
          },
        },
      ]
    : undefined

  const body: Record<string, unknown> = {
    model: 'google/gemini-3-flash-preview',
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
  }
  if (openAITools) body['tools'] = openAITools

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    if (response.status === 429) throw new Error('Rate limit exceeded. Try again shortly.')
    if (response.status === 402) throw new Error('AI credits exhausted.')
    const errText = await response.text()
    console.error('AI gateway error:', response.status, errText)
    throw new Error('AI gateway error')
  }

  const aiResult = await response.json()
  const choice = aiResult.choices?.[0]

  // Check for tool_calls (OpenAI newer format) or function_call (OpenAI legacy)
  const toolCalls = choice?.message?.tool_calls
  if (toolCalls && toolCalls.length > 0) {
    const tc = toolCalls[0]
    try {
      const args = JSON.parse(tc.function?.arguments ?? '{}')
      return { toolCall: { id: tc.id ?? tc.function?.name, name: tc.function?.name, args } }
    } catch {
      console.warn('Failed to parse tool_call arguments', tc.function?.arguments)
    }
  }

  // Legacy function_call format
  if (choice?.message?.function_call) {
    const fc = choice.message.function_call
    try {
      const args = JSON.parse(fc.arguments ?? '{}')
      return { toolCall: { id: fc.name, name: fc.name, args } }
    } catch {
      console.warn('Failed to parse function_call arguments', fc.arguments)
    }
  }

  const text = choice?.message?.content ?? ''
  return { text }
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`

    // For non-service-role callers, validate user JWT
    if (!isServiceRole) {
      if (!authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders,
        })
      }
      const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      })
      const token = authHeader.replace('Bearer ', '')
      const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token)
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders,
        })
      }
    }

    const body = await req.json()
    const mode: 'suggest' | 'auto_reply' = body.mode ?? 'suggest'

    // auto_reply mode is only callable from internal service-role callers
    if (mode === 'auto_reply' && !isServiceRole) {
      return new Response(JSON.stringify({ error: 'Forbidden: auto_reply mode requires service role' }), {
        status: 403,
        headers: corsHeaders,
      })
    }

    const {
      contact_name,
      phone_number,
      recent_messages,
      context_type,
      branch_id,
      latest_message,
    } = body

    if (!recent_messages || !Array.isArray(recent_messages)) {
      return new Response(
        JSON.stringify({ error: 'recent_messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Epic 2: Context Hydration ────────────────────────────────────────────
    const contactContext = phone_number
      ? await hydrateContactContext(phone_number)
      : 'Context: You are speaking to an unregistered Lead.'

    // ── Epic 3: AI Flow Config ───────────────────────────────────────────────
    const aiFlowConfig = mode === 'auto_reply' ? await getAiFlowConfig() : null

    let systemPrompt: string
    if (mode === 'auto_reply' && aiFlowConfig) {
      const fieldList = aiFlowConfig.target_fields
        .map((f) => f.replace(/_/g, ' '))
        .join(', ')
      systemPrompt = `You are an autonomous WhatsApp lead generation assistant for a fitness gym called "Incline Fitness".

${contactContext}

Your primary goal is to naturally and conversationally collect the following information from the user:
${fieldList}

Rules:
- Be warm, friendly, and professional. Use the user's language (English or Hindi-English mix).
- Collect fields ONE AT A TIME — do not ask for everything at once.
- Once ALL fields (${fieldList}) have been collected in the conversation, STOP chatting and respond ONLY with the following strict JSON (no markdown, no extra text):
  {"status":"lead_captured","data":{"name":"...","phone":"...","fitness_goal":"...","expected_start_date":"...","budget":"..."}}
  (include only the fields you actually collected)
- NEVER reveal that you are an AI or a bot.
- For existing members, help them with scheduling or booking if needed.`
    } else {
      // suggest mode — original staff-assistant behaviour
      const conversationHistory = recent_messages
        .slice(-10)
        .map((m: { direction: string; content: string }) =>
          `${m.direction === 'inbound' ? contact_name || 'Customer' : 'Staff'}: ${m.content}`
        )
        .join('\n')

      systemPrompt = `You are a helpful gym reception assistant for "Incline Fitness". Generate a professional, friendly WhatsApp reply suggestion. Keep it short (1-3 sentences max). Be warm but professional. Use the customer's name when available.

${contactContext}
Context type: ${context_type || 'general'}
${contact_name ? `Customer name: ${contact_name}` : ''}
${phone_number ? `Phone: ${phone_number}` : ''}

Guidelines:
- For inquiries: Provide helpful info and invite them to visit
- For complaints: Be empathetic, acknowledge, and offer resolution
- For membership queries: Mention benefits and offer to schedule a tour
- For payment queries: Be professional and offer to help resolve
- Always end with a clear next step or call-to-action
- Keep the tone conversational but professional
- Use English or Hindi-English mix based on the customer's language

Recent conversation:
${conversationHistory}`
    }

    // Build conversation messages in OpenAI format
    const convMessages: ConvMessage[] = recent_messages
      .slice(-10)
      .map((m: { direction: string; content: string }) => ({
        role: (m.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content ?? '',
      }))

    // Add the latest inbound message if provided separately (auto_reply mode)
    if (mode === 'auto_reply' && latest_message) {
      convMessages.push({ role: 'user', content: latest_message })
    }

    // ── Epic 4: Tool calling loop ────────────────────────────────────────────
    let finalText = ''
    let loopMessages: ConvMessage[] = [...convMessages]
    const maxToolRounds = 3

    for (let round = 0; round < maxToolRounds; round++) {
      const result = await callGemini(systemPrompt, loopMessages, mode === 'auto_reply')

      if (result.toolCall) {
        // Execute mocked tool and feed result back in OpenAI tool format
        const toolResult = executeMockedTool(result.toolCall.name, result.toolCall.args)
        // Append assistant tool_call message and tool result
        loopMessages = [
          ...loopMessages,
          {
            role: 'assistant',
            content: JSON.stringify({ tool_call: { name: result.toolCall.name, args: result.toolCall.args } }),
          },
          {
            role: 'tool',
            content: toolResult,
            tool_call_id: result.toolCall.id,
            name: result.toolCall.name,
          },
        ]
        continue
      }

      finalText = result.text ?? ''
      break
    }

    // ── Epic 3: Detect lead_captured JSON ───────────────────────────────────
    if (mode === 'auto_reply' && aiFlowConfig && finalText) {
      // Robustly extract JSON: find the first '{' and last '}' containing lead_captured
      let extractedJson: string | null = null
      try {
        const firstBrace = finalText.indexOf('{')
        const lastBrace = finalText.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          extractedJson = finalText.slice(firstBrace, lastBrace + 1)
        }
      } catch {
        // ignore
      }

      if (extractedJson) {
        try {
          const parsed = JSON.parse(extractedJson)
          if (parsed.status === 'lead_captured' && parsed.data && branch_id) {
            const handoffReply = await captureLead(
              branch_id,
              phone_number,
              parsed.data as CapturedLeadData,
              aiFlowConfig.handoff_message
            )
            return new Response(
              JSON.stringify({ auto_reply: handoffReply, lead_captured: true }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        } catch (parseErr) {
          console.warn('Failed to parse lead_captured JSON', parseErr)
        }
      }
    }

    if (mode === 'auto_reply') {
      // Autonomously send the reply via send-whatsapp and persist the outbound message
      if (finalText && branch_id && phone_number) {
        const { data: msgRow, error: msgInsertErr } = await serviceClient
          .from('whatsapp_messages')
          .insert({
            branch_id,
            phone_number,
            contact_name: contact_name ?? null,
            content: finalText,
            direction: 'outbound',
            status: 'pending',
            message_type: 'text',
            sent_by: 'ai_bot',
          })
          .select('id')
          .single()

        if (msgInsertErr) {
          console.error('Failed to insert AI outbound message', msgInsertErr)
        } else if (msgRow?.id) {
          serviceClient.functions.invoke('send-whatsapp', {
            body: {
              message_id: msgRow.id,
              phone_number,
              content: finalText,
              branch_id,
            },
          })
        }
      }

      return new Response(
        JSON.stringify({ auto_reply: finalText, lead_captured: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // suggest mode — return text for staff to review
    return new Response(
      JSON.stringify({ suggested_reply: finalText || 'Unable to generate suggestion.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('AI auto-reply error:', error)
    const errMsg = error instanceof Error ? error.message : 'Unknown error'

    if (errMsg.includes('Rate limit')) {
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (errMsg.includes('credits')) {
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
