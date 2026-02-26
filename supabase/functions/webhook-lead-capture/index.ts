import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook secret
    const webhookSecret = Deno.env.get('WEBHOOK_LEAD_SECRET');
    const providedSecret = req.headers.get('x-webhook-secret');

    if (!webhookSecret || providedSecret !== webhookSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentLength = parseInt(req.headers.get('content-length') || '0');
    if (contentLength > 10240) {
      return new Response(
        JSON.stringify({ error: 'Request too large' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();

    // Support multiple field name formats (Zapier, Make, etc.)
    const fullName = (body.full_name || body.fullName || body.name || '').trim().slice(0, 100);
    const phone = (body.phone || body.phone_number || body.mobile || '').replace(/[\s\-\(\)]/g, '').slice(0, 20);
    const email = (body.email || '').trim().slice(0, 255) || null;
    const source = (body.source || body.utm_source || body.platform || 'api').toLowerCase().slice(0, 50);
    const utmSource = (body.utm_source || source).slice(0, 100);
    const utmMedium = (body.utm_medium || '').slice(0, 100);
    const utmCampaign = (body.utm_campaign || '').slice(0, 100);
    const notes = (body.notes || body.message || '').slice(0, 500);

    if (!fullName || fullName.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Name is required (min 2 chars)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!phone || phone.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Valid phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, message: 'Lead already exists', lead_id: existing.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get first active branch
    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!branch) {
      return new Response(
        JSON.stringify({ error: 'No active branch found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert({
        full_name: fullName,
        phone,
        email,
        source,
        branch_id: branch.id,
        status: 'new',
        notes,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to create lead:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create lead' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Webhook lead created:', lead.id, 'source:', source);

    return new Response(
      JSON.stringify({ success: true, lead_id: lead.id }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook lead capture error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
