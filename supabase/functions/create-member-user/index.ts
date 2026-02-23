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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify the calling user is admin/owner/manager/staff
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: callingUser }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !callingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if calling user has permission to create members
    const { data: callerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callingUser.id)
      .in('role', ['owner', 'admin', 'manager', 'staff'])

    if (!callerRoles || callerRoles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { 
      email, 
      fullName, 
      phone, 
      branchId,
      gender,
      dateOfBirth,
      address,
      emergencyContactName,
      emergencyContactPhone,
      source,
      fitnessGoals,
      healthConditions,
      referredBy,
      createdBy
    } = await req.json()

    if (!email || !fullName || !branchId) {
      return new Response(
        JSON.stringify({ error: 'Email, fullName, and branchId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user with this email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    )

    let userId: string

    if (existingUser) {
      // Check if a member record already exists for this auth user
      const { data: existingMember } = await supabaseAdmin
        .from('members')
        .select('id')
        .eq('user_id', existingUser.id)
        .maybeSingle()

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: 'A member with this email already exists', code: 'email_exists' }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Orphaned auth user (no member record) -- reuse it
      console.log('Reusing orphaned auth user:', existingUser.id)
      userId = existingUser.id

      // Update their profile
      await supabaseAdmin
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone || null,
          gender: gender || null,
          date_of_birth: dateOfBirth || null,
          address: address || null,
          emergency_contact_name: emergencyContactName || null,
          emergency_contact_phone: emergencyContactPhone || null,
          must_set_password: true,
        })
        .eq('id', userId)

      // Ensure member role exists
      await supabaseAdmin
        .from('user_roles')
        .upsert(
          { user_id: userId, role: 'member' },
          { onConflict: 'user_id,role' }
        )

    } else {
      // Create new auth user
      const tempPassword = crypto.randomUUID().slice(0, 12)

      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })

      if (createError) {
        console.error('Auth create error:', createError)
        throw createError
      }

      console.log('User created:', authData.user.id)
      userId = authData.user.id

      // Update profile with all details
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone || null,
          gender: gender || null,
          date_of_birth: dateOfBirth || null,
          address: address || null,
          emergency_contact_name: emergencyContactName || null,
          emergency_contact_phone: emergencyContactPhone || null,
          must_set_password: true,
        })
        .eq('id', userId)

      if (profileError) {
        console.error('Profile update error:', profileError)
      }

      // Assign member role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: userId, role: 'member' })

      if (roleError) {
        console.error('Role insert error:', roleError)
        throw roleError
      }
    }

    // Create member record -- member_code is omitted so the DB trigger generates it
    const { data: member, error: memberError } = await supabaseAdmin
      .from('members')
      .insert({
        user_id: userId,
        branch_id: branchId,
        status: 'active',
        source: source || 'walk-in',
        fitness_goals: fitnessGoals || null,
        health_conditions: healthConditions || null,
        referred_by: referredBy || null,
        created_by: createdBy || callingUser.id,
      })
      .select('id, member_code')
      .single()

    if (memberError) {
      console.error('Member insert error:', memberError)
      throw memberError
    }

    console.log('Member created:', member.id)

    // Auto-create referral record if referred_by is set
    if (referredBy) {
      try {
        // referredBy is a member ID — create a referral record
        const { data: referrer } = await supabaseAdmin
          .from('members')
          .select('id, member_code')
          .eq('id', referredBy)
          .single()

        if (referrer) {
          await supabaseAdmin
            .from('referrals')
            .insert({
              referrer_member_id: referrer.id,
              referred_name: fullName,
              referred_email: email,
              referred_phone: phone || null,
              referral_code: referrer.member_code,
              status: 'converted',
              branch_id: branchId,
              converted_member_id: member.id,
              converted_at: new Date().toISOString(),
            })
          console.log('Referral record created for referrer:', referrer.id)
        }
      } catch (refErr) {
        console.error('Referral record creation failed (non-fatal):', refErr)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: userId,
        memberId: member.id,
        memberCode: member.member_code,
        message: 'Member created successfully. They will set their password on first login.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('Error in create-member-user:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
