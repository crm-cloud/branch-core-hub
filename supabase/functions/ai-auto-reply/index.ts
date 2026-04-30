// v2.0.0 — AI auto-reply with conversation memory + human handoff tool
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const HANDOFF_TOOL = {
  type: 'function',
  function: {
    name: 'trigger_human_handoff',
    description: 'Pause the AI bot and notify a human staff member to take over this conversation. Call when: the user explicitly asks for a human, expresses frustration or anger, asks about refunds/medical/legal matters, asks complex pricing questions you are not certain about, or when you have failed twice to address the same intent.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Short explanation of why a human is needed (max 140 chars).' },
        urgency: { type: 'string', enum: ['low', 'medium', 'high'], description: 'low for general curiosity, medium for default, high for upset users or urgent issues.' },
      },
      required: ['reason', 'urgency'],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { contact_name, phone_number, recent_messages, context_type } = await req.json();

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Hydrate conversation memory (last 10) from DB
    let conversationMessages = recent_messages || [];
    if (phone_number && (!conversationMessages || conversationMessages.length < 5)) {
      try {
        const { data: dbMessages } = await serviceClient
          .from('whatsapp_messages')
          .select('content, direction, platform')
          .eq('phone_number', phone_number)
          .eq('is_internal_note', false)
          .order('created_at', { ascending: false })
          .limit(10);
        if (dbMessages && dbMessages.length > 0) {
          conversationMessages = dbMessages.reverse().map((m: any) => ({
            content: m.content,
            direction: m.direction,
          }));
        }
      } catch (e) {
        console.warn('Failed to hydrate messages from DB:', e);
      }
    }

    if (!conversationMessages || !Array.isArray(conversationMessages) || conversationMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No messages available for context' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve member/lead profile for context block
    let profileBlock = '';
    let resolvedBranchId: string | null = null;
    if (phone_number) {
      try {
        const { data: lead } = await serviceClient
          .from('leads')
          .select('full_name, status, fitness_goal, branch_id')
          .eq('phone', phone_number)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lead) {
          resolvedBranchId = lead.branch_id;
          profileBlock += `\n[Lead] Name: ${lead.full_name || contact_name || '—'}, Status: ${lead.status || '—'}, Goal: ${lead.fitness_goal || '—'}`;
        }

        const { data: profile } = await serviceClient
          .from('profiles')
          .select('user_id, full_name')
          .eq('phone', phone_number)
          .maybeSingle();
        if (profile?.user_id) {
          const { data: member } = await serviceClient
            .from('members')
            .select('id, member_code, status, branch_id, fitness_goals')
            .eq('user_id', profile.user_id)
            .maybeSingle();
          if (member) {
            resolvedBranchId = member.branch_id;
            const { data: ms } = await serviceClient
              .from('memberships')
              .select('status, end_date, plan_id, membership_plans(name)')
              .eq('member_id', member.id)
              .order('end_date', { ascending: false })
              .limit(1)
              .maybeSingle();
            const { data: lastAtt } = await serviceClient
              .from('member_attendance')
              .select('check_in')
              .eq('member_id', member.id)
              .order('check_in', { ascending: false })
              .limit(1)
              .maybeSingle();
            profileBlock += `\n[Member] ${profile.full_name || contact_name || '—'} (${member.member_code || '—'}), Status: ${member.status || '—'}`;
            if (ms) {
              const planName = (ms as any).membership_plans?.name || 'Plan';
              profileBlock += `, Plan: ${planName} expires ${ms.end_date || '—'}`;
            }
            if (lastAtt?.check_in) {
              profileBlock += `, Last visit: ${new Date(lastAtt.check_in).toISOString().slice(0, 10)}`;
            }
          }
        }
      } catch (e) {
        console.warn('Profile resolve failed:', e);
      }
    }

    const conversationHistory = conversationMessages
      .slice(-10)
      .map((m: any) => `${m.direction === 'inbound' ? contact_name || 'Customer' : 'Staff'}: ${m.content}`)
      .join('\n');

    // Custom prompt from org settings
    let customPrompt: string | null = null;
    try {
      const { data: orgSettings } = await serviceClient
        .from('organization_settings')
        .select('whatsapp_ai_config')
        .limit(1)
        .maybeSingle();
      const aiConfig = orgSettings?.whatsapp_ai_config as any;
      if (aiConfig?.system_prompt) customPrompt = aiConfig.system_prompt;
    } catch (e) { /* ignore */ }

    const basePrompt = customPrompt || `You are a helpful gym reception assistant for "Incline Fitness". Generate a professional, friendly WhatsApp reply suggestion. Keep it short (1-3 sentences). Be warm but professional. Use the customer's name when available.

Guidelines:
- For inquiries: Provide helpful info and invite them to visit
- For complaints: Be empathetic, acknowledge, and offer resolution
- For membership/pricing queries: Give general info, but escalate to a human for specific quotes or refunds
- Always end with a clear next step
- Use English or Hindi-English mix based on the customer's language`;

    const systemPrompt = `${basePrompt}

Context type: ${context_type || 'general'}
${contact_name ? `Customer name: ${contact_name}` : ''}
${phone_number ? `Phone: ${phone_number}` : ''}
${profileBlock ? `\nProfile data:${profileBlock}` : ''}

HUMAN HANDOFF: You have access to a tool called \`trigger_human_handoff\`. Call it (instead of replying) when:
- The user explicitly asks for a human, manager, or "real person".
- The user is angry, frustrated, or threatening to cancel.
- The user asks about refunds, medical issues, legal matters, or specific custom pricing.
- You have already replied twice on the same topic without resolving it.
When you call the tool, do NOT also write a reply.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Recent conversation:\n\n${conversationHistory}\n\nGenerate a suggested reply OR call trigger_human_handoff.` },
        ],
        tools: [HANDOFF_TOOL],
        tool_choice: 'auto',
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again shortly.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const errText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errText);
      throw new Error('AI gateway error');
    }

    const aiResult = await aiResponse.json();
    const choice = aiResult.choices?.[0]?.message;
    const toolCall = choice?.tool_calls?.[0];

    // Handoff path
    if (toolCall?.function?.name === 'trigger_human_handoff') {
      let args: any = {};
      try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch { /* ignore */ }
      const reason = String(args.reason || 'Human assistance requested').slice(0, 200);
      const urgency = ['low', 'medium', 'high'].includes(args.urgency) ? args.urgency : 'medium';

      try {
        await serviceClient.rpc('set_handoff', {
          _phone: phone_number,
          _reason: reason,
          _urgency: urgency,
        });
      } catch (e) {
        console.error('set_handoff RPC failed:', e);
      }

      return new Response(
        JSON.stringify({
          handoff: true,
          reason,
          urgency,
          suggested_reply: `[AI HANDOFF — ${urgency.toUpperCase()}] ${reason}`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const suggestedReply = choice?.content || 'Unable to generate suggestion.';
    return new Response(
      JSON.stringify({ suggested_reply: suggestedReply, handoff: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('AI auto-reply error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
