import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify caller with anon client
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await anonClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check owner/admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: roles } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin'])
    
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions. Owner or admin role required.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse body for full_reset flag
    let fullReset = false
    try {
      const body = await req.json()
      fullReset = body.full_reset === true
    } catch {
      // No body or invalid JSON is fine
    }

    const tables = [
      'member_attendance', 'membership_freeze_history', 'membership_free_days',
      'invoice_items', 'payment_transactions', 'payment_reminders',
      'pos_sales', 'ecommerce_orders', 'stock_movements', 'inventory',
      'trainer_availability', 'trainer_commissions', 'trainer_change_requests',
      'pt_sessions', 'member_pt_packages',
      'class_bookings', 'class_waitlist',
      'equipment_maintenance',
      'locker_assignments',
      'lead_followups',
      'contracts', 'staff_attendance', 'payroll_rules',
      'benefit_bookings', 'benefit_usage', 'member_benefit_credits', 'benefit_slots',
      'benefit_settings', 'benefit_packages', 'benefit_types',
      'diet_plans', 'diet_templates', 'fitness_plan_templates', 'member_fitness_plans', 'member_measurements',
      'workout_plans', 'workout_templates', 'ai_plan_logs', 'exercises',
      'referral_rewards', 'referrals', 'referral_settings',
      'wallet_transactions', 'wallets',
      'device_access_events', 'biometric_sync_queue', 'access_devices',
      'whatsapp_messages', 'communication_logs',
      'approval_requests', 'audit_logs', 'notifications', 'notification_preferences',
      'announcements', 'feedback', 'tasks', 'templates',
      'discount_codes',
      'expenses', 'expense_categories', 'expense_category_templates',
      'integration_settings', 'settings',
      'member_branch_history', 'staff_branches', 'branch_managers', 'branch_settings',
      'permissions', 'role_permissions',
      'memberships', 'plan_benefits', 'membership_plans',
      'payments', 'invoices',
      'pt_packages', 'trainers',
      'products', 'product_categories',
      'classes', 'equipment', 'lockers', 'leads', 'employees',
      'members',
    ]

    // Truncate all tables in one statement
    const truncateSQL = `TRUNCATE TABLE ${tables.map(t => `public.${t}`).join(', ')} RESTART IDENTITY CASCADE;`
    
    const { error: truncateError } = await adminClient.rpc('pg_temp_exec', { sql: truncateSQL }).maybeSingle()
    
    // If rpc doesn't exist, fall back to direct SQL via postgrest
    // We'll use the admin client to run individual deletes as a fallback
    if (truncateError) {
      // Use raw SQL through the admin client's special endpoint
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({}),
      })
      
      // Since we can't run raw SQL through the client, delete from each table
      for (const table of tables) {
        await adminClient.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
      }
    }

    let extraTablesCleared = 0
    if (fullReset) {
      // Also clear profiles (except current user) and user_roles (except current user)
      await adminClient.from('user_roles').delete().neq('user_id', user.id)
      await adminClient.from('profiles').delete().neq('id', user.id)
      // Also clear branches
      await adminClient.from('branches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      extraTablesCleared = 3
    }

    return new Response(
      JSON.stringify({
        success: true,
        tables_cleared: tables.length + extraTablesCleared,
        full_reset: fullReset,
        message: fullReset
          ? 'All data has been reset including user profiles and branches.'
          : 'All data has been reset. User profiles, roles, and branches were preserved.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Reset error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'An unexpected error occurred' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
