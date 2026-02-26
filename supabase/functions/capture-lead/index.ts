import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation constants
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 255;
const MAX_PHONE_LENGTH = 20;
const MAX_SOURCE_LENGTH = 50;
const ALLOWED_SOURCES = ['website', 'walk-in', 'referral', 'social', 'phone', 'instagram', 'facebook', 'google_ads', 'landing_page', 'embed', 'api', 'other'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9]{10,15}$/;
const NAME_REGEX = /^[a-zA-Z\s\-'.]+$/;

// Sanitize string input
function sanitizeString(str: string, maxLength: number): string {
  return str
    .trim()
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control chars
    .slice(0, maxLength);
}

// Validate name
function validateName(name: string): { valid: boolean; error?: string } {
  if (!name) return { valid: false, error: 'Name is required' };
  if (name.length < 2) return { valid: false, error: 'Name must be at least 2 characters' };
  if (name.length > MAX_NAME_LENGTH) return { valid: false, error: 'Name is too long' };
  if (!NAME_REGEX.test(name)) return { valid: false, error: 'Name contains invalid characters' };
  return { valid: true };
}

// Validate phone
function validatePhone(phone: string): { valid: boolean; cleanPhone?: string; error?: string } {
  if (!phone) return { valid: false, error: 'Phone number is required' };
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  if (cleanPhone.length < 10) return { valid: false, error: 'Please enter a valid phone number' };
  if (cleanPhone.length > MAX_PHONE_LENGTH) return { valid: false, error: 'Phone number is too long' };
  if (!PHONE_REGEX.test(cleanPhone)) return { valid: false, error: 'Invalid phone number format' };
  return { valid: true, cleanPhone };
}

// Validate email (optional)
function validateEmail(email: string | undefined): { valid: boolean; error?: string } {
  if (!email) return { valid: true }; // Email is optional
  if (email.length > MAX_EMAIL_LENGTH) return { valid: false, error: 'Email is too long' };
  if (!EMAIL_REGEX.test(email)) return { valid: false, error: 'Invalid email format' };
  return { valid: true };
}

// Validate source
function validateSource(source: string | undefined): string {
  if (!source) return 'website';
  const cleanSource = source.toLowerCase().trim().slice(0, MAX_SOURCE_LENGTH);
  return ALLOWED_SOURCES.includes(cleanSource) ? cleanSource : 'other';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check request size
    const contentLength = parseInt(req.headers.get('content-length') || '0');
    if (contentLength > 10240) { // 10KB max
      return new Response(
        JSON.stringify({ error: 'Request too large' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    
    // Sanitize inputs
    const fullName = sanitizeString(body.fullName || '', MAX_NAME_LENGTH);
    const phone = sanitizeString(body.phone || '', MAX_PHONE_LENGTH);
    const email = body.email ? sanitizeString(body.email, MAX_EMAIL_LENGTH) : undefined;
    const source = validateSource(body.source);

    console.log('Received lead capture request:', { 
      fullName: fullName.slice(0, 3) + '***', 
      phone: phone.slice(0, 4) + '****',
      source 
    });

    // Validate name
    const nameValidation = validateName(fullName);
    if (!nameValidation.valid) {
      return new Response(
        JSON.stringify({ error: nameValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate phone
    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      return new Response(
        JSON.stringify({ error: phoneValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email if provided
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return new Response(
        JSON.stringify({ error: emailValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing lead with same phone
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('phone', phoneValidation.cleanPhone || phone)
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
        full_name: fullName,
        phone: phoneValidation.cleanPhone || phone,
        email: email || null,
        source,
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