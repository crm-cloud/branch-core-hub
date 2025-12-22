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
      console.log('No authorization header provided')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify the calling user is admin/owner
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: callingUser }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !callingUser) {
      console.log('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if calling user has admin/owner role
    const { data: callerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callingUser.id)
      .in('role', ['owner', 'admin'])

    if (!callerRoles || callerRoles.length === 0) {
      console.log('Insufficient permissions for user:', callingUser.id)
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    console.log('Request body:', JSON.stringify(body))
    
    // Support both naming conventions
    const email = body.email
    const fullName = body.fullName || body.full_name
    const phone = body.phone
    const role = body.role
    const branchId = body.branchId || body.branch_id
    const gender = body.gender
    const dateOfBirth = body.dateOfBirth || body.date_of_birth
    
    // Trainer-specific fields
    const salaryType = body.salaryType || body.salary_type
    const fixedSalary = body.fixedSalary || body.fixed_salary
    const hourlyRate = body.hourlyRate || body.hourly_rate
    const ptSharePercentage = body.ptSharePercentage || body.pt_share_percentage
    const governmentIdType = body.governmentIdType || body.government_id_type
    const governmentIdNumber = body.governmentIdNumber || body.government_id_number
    const specializations = body.specializations

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!role || !['trainer', 'staff', 'manager', 'admin', 'owner'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Valid role is required (trainer, staff, manager, admin, owner)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!branchId) {
      return new Response(
        JSON.stringify({ error: 'Branch ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate a temporary password
    const tempPassword = crypto.randomUUID().slice(0, 12)
    console.log('Creating user with email:', email)

    // Create the user with email confirmed (they'll set password on first login)
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    })

    if (createError) {
      console.log('User creation error:', createError.message)
      throw createError
    }

    console.log('User created successfully:', authData.user.id)

    // Update profile with additional fields
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        full_name: fullName, 
        phone,
        gender,
        date_of_birth: dateOfBirth,
        must_set_password: true 
      })
      .eq('id', authData.user.id)

    if (profileError) {
      console.log('Profile update error:', profileError.message)
    }

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: authData.user.id, role })

    if (roleError) {
      console.log('Role assignment error:', roleError.message)
      throw roleError
    }

    // Assign to branch
    const { error: branchError } = await supabaseAdmin
      .from('staff_branches')
      .insert({ user_id: authData.user.id, branch_id: branchId })

    if (branchError) {
      console.log('Branch assignment error:', branchError.message)
      // Don't throw - this might fail if table doesn't exist
    }

    // If role is trainer, create trainer record
    let trainerId = null
    if (role === 'trainer') {
      const trainerCode = 'TR-' + Date.now().toString(36).toUpperCase()
      const { data: trainerData, error: trainerError } = await supabaseAdmin
        .from('trainers')
        .insert({
          user_id: authData.user.id,
          branch_id: branchId,
          trainer_code: trainerCode,
          specializations: specializations || [],
          salary_type: salaryType,
          fixed_salary: fixedSalary,
          hourly_rate: hourlyRate,
          pt_share_percentage: ptSharePercentage,
          government_id_type: governmentIdType,
          government_id_number: governmentIdNumber,
          is_active: true,
        })
        .select('id')
        .single()

      if (trainerError) {
        console.log('Trainer creation error:', trainerError.message)
        throw trainerError
      }
      trainerId = trainerData?.id
      console.log('Trainer created with ID:', trainerId)
    }

    // If role is staff or manager, create employee record
    let employeeId = null
    if (role === 'staff' || role === 'manager') {
      const employeeCode = 'EMP-' + Date.now().toString(36).toUpperCase()
      const { data: employeeData, error: employeeError } = await supabaseAdmin
        .from('employees')
        .insert({
          user_id: authData.user.id,
          branch_id: branchId,
          employee_code: employeeCode,
          hire_date: new Date().toISOString().split('T')[0],
          position: role === 'manager' ? 'Branch Manager' : 'Staff',
          is_active: true,
        })
        .select('id')
        .single()

      if (employeeError) {
        console.log('Employee creation error:', employeeError.message)
        // Don't throw - trainer/employee creation is secondary
      } else {
        employeeId = employeeData?.id
        console.log('Employee created with ID:', employeeId)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: authData.user.id,
        trainerId,
        employeeId,
        message: `${role} user created successfully. They will set their password on first login.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in create-staff-user function:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
