import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = claimsData.claims.sub;

    // Check user is owner or admin
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: roles } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['owner', 'admin']);

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: 'Only owners and admins can export data' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Export tables
    const tablesToExport = [
      'branches', 'branch_settings', 'organization_settings',
      'profiles', 'user_roles', 'members', 'memberships', 'membership_plans', 'plan_benefits',
      'trainers', 'employees', 'contracts',
      'invoices', 'invoice_items', 'payments',
      'member_attendance', 'staff_attendance',
      'classes', 'class_bookings',
      'benefit_types', 'benefit_settings', 'benefit_slots', 'benefit_bookings', 'benefit_usage', 'benefit_packages',
      'facilities',
      'leads', 'lead_follow_ups',
      'equipment', 'equipment_maintenance',
      'lockers', 'locker_assignments',
      'feedback', 'announcements',
      'discount_codes', 'referrals', 'referral_rewards', 'referral_settings',
      'templates', 'notification_preferences',
      'integration_settings',
    ];

    const exportData: Record<string, any> = {
      exported_at: new Date().toISOString(),
      exported_by: userId,
      tables: {},
    };

    for (const table of tablesToExport) {
      try {
        const { data, error } = await serviceClient
          .from(table)
          .select('*')
          .limit(10000);
        
        if (!error && data) {
          exportData.tables[table] = {
            count: data.length,
            rows: data,
          };
        } else {
          exportData.tables[table] = { count: 0, rows: [], error: error?.message };
        }
      } catch {
        exportData.tables[table] = { count: 0, rows: [], error: 'Table not found or inaccessible' };
      }
    }

    return new Response(
      JSON.stringify(exportData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Export error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
