import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    // Authenticate user
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

    // Service client for DB queries
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Module 2: Hydrate conversation memory from DB
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

    // Build conversation context
    const conversationHistory = conversationMessages
      .slice(-10)
      .map((m: any) => `${m.direction === 'inbound' ? contact_name || 'Customer' : 'Staff'}: ${m.content}`)
      .join('\n');

    // Fetch custom system prompt from organization_settings
    let customPrompt: string | null = null;
    try {
      const { data: orgSettings } = await serviceClient
        .from('organization_settings')
        .select('whatsapp_ai_config')
        .limit(1)
        .maybeSingle();
      const aiConfig = orgSettings?.whatsapp_ai_config as any;
      if (aiConfig?.system_prompt) {
        customPrompt = aiConfig.system_prompt;
      }
    } catch (e) {
      console.warn('Failed to fetch org AI config, using default prompt:', e);
    }

    const systemPrompt = customPrompt || `You are a helpful gym reception assistant for "Incline Fitness". Generate a professional, friendly WhatsApp reply suggestion. Keep it short (1-3 sentences max). Be warm but professional. Use the customer's name when available. 

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
- Use English or Hindi-English mix based on the customer's language`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here is the recent conversation:\n\n${conversationHistory}\n\nGenerate a suggested reply for the staff to send.` }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again shortly.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      throw new Error('AI gateway error');
    }

    const aiResult = await response.json();
    const suggestedReply = aiResult.choices?.[0]?.message?.content || 'Unable to generate suggestion.';

    return new Response(
      JSON.stringify({ suggested_reply: suggestedReply }),
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
