import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // First check if owner already exists
    const { data: existingOwner } = await supabase
      .from('user_roles')
      .select('id')
      .eq('role', 'owner')
      .limit(1)

    if (existingOwner && existingOwner.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Owner already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email, password, fullName } = await req.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    })

    if (authError) throw authError

    // Update profile with full name
    await supabase
      .from('profiles')
      .update({ full_name: fullName, must_set_password: false })
      .eq('id', authData.user.id)

    // Assign owner role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: authData.user.id, role: 'owner' })

    if (roleError) throw roleError

    return new Response(
      JSON.stringify({ success: true, userId: authData.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
