import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadRequest {
  fullName: string;
  phone: string;
  email?: string;
  source?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: LeadRequest = await req.json();
    console.log('Received lead capture request:', { ...body, phone: body.phone?.slice(0, 4) + '****' });

    // Validate required fields
    if (!body.fullName || !body.phone) {
      return new Response(
        JSON.stringify({ error: 'Name and phone are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Basic phone validation
    const phoneClean = body.phone.replace(/\D/g, '');
    if (phoneClean.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid phone number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing lead with same phone
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('phone', body.phone)
      .maybeSingle();

    if (existingLead) {
      console.log('Lead already exists with this phone number');
      // Return success anyway to not reveal existing leads
      return new Response(
        JSON.stringify({ success: true, message: 'Thank you! We will contact you soon.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get first branch as default
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (branchError || !branch) {
      console.error('No active branch found:', branchError);
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        full_name: body.fullName,
        phone: body.phone,
        email: body.email || null,
        source: body.source || 'website',
        branch_id: branch.id,
        status: 'new',
      })
      .select()
      .single();

    if (leadError) {
      console.error('Failed to create lead:', leadError);
      return new Response(
        JSON.stringify({ error: 'Failed to submit. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Lead created successfully:', lead.id);

    return new Response(
      JSON.stringify({ success: true, message: 'Thank you! We will contact you soon.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Capture lead error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
