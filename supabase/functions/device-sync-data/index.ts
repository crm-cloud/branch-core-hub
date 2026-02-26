import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface SyncItem {
  id: string;
  person_uuid: string;
  person_name: string;
  photo_url: string;
  action: 'add' | 'update' | 'delete';
  wiegand_code?: string;
  custom_message?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const device_id = url.searchParams.get('device_id');
    const mode = url.searchParams.get('mode') || 'incremental';
    const limit = parseInt(url.searchParams.get('limit') || '50');

    if (!device_id) {
      return new Response(
        JSON.stringify({ error: 'device_id query parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify device exists
    const { data: device, error: deviceError } = await supabase
      .from('access_devices')
      .select('id, branch_id')
      .eq('id', device_id)
      .single();

    if (deviceError || !device) {
      return new Response(
        JSON.stringify({ error: 'Device not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === FULL ROSTER MODE ===
    if (mode === 'full') {
      // Get all members for this branch with hardware access enabled and biometric photo
      const { data: members, error: membersError } = await supabase
        .from('members')
        .select(`
          id, member_code, branch_id, user_id, 
          biometric_photo_url, biometric_enrolled,
          wiegand_code, custom_welcome_message, hardware_access_enabled,
          status
        `)
        .eq('branch_id', device.branch_id)
        .eq('hardware_access_enabled', true)
        .not('biometric_photo_url', 'is', null);

      if (membersError) {
        console.error('Members query error:', membersError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch members' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get profile names for members
      const userIds = (members || []).map(m => m.user_id).filter(Boolean);
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        profileMap = (profiles || []).reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.full_name || 'Member';
          return acc;
        }, {});
      }

      // Check active memberships
      const memberIds = (members || []).map(m => m.id);
      let activeMembershipSet = new Set<string>();
      if (memberIds.length > 0) {
        const { data: activeMemberships } = await supabase
          .from('memberships')
          .select('member_id')
          .in('member_id', memberIds)
          .eq('status', 'active')
          .gte('end_date', new Date().toISOString().split('T')[0]);
        
        activeMembershipSet = new Set((activeMemberships || []).map(m => m.member_id));
      }

      const roster = (members || []).map(m => {
        const personName = profileMap[m.user_id] || 'Member';
        let customMsg = m.custom_welcome_message || 'Welcome! Enjoy your workout';
        customMsg = customMsg.replace('{name}', personName);

        return {
          member_id: m.id,
          wiegand_code: m.wiegand_code,
          avatar_url: m.biometric_photo_url,
          custom_message: customMsg,
          access_allowed: m.status === 'active' && m.hardware_access_enabled && activeMembershipSet.has(m.id),
          person_name: personName,
        };
      });

      // Also get staff with biometric photos
      const { data: staff } = await supabase
        .from('employees')
        .select('id, user_id, biometric_photo_url, is_active')
        .eq('branch_id', device.branch_id)
        .eq('is_active', true)
        .not('biometric_photo_url', 'is', null);

      const staffUserIds = (staff || []).map(s => s.user_id).filter(Boolean);
      let staffProfileMap: Record<string, string> = {};
      if (staffUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', staffUserIds);
        staffProfileMap = (profiles || []).reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.full_name || 'Staff';
          return acc;
        }, {});
      }

      const staffRoster = (staff || []).map(s => ({
        member_id: s.id,
        wiegand_code: null,
        avatar_url: s.biometric_photo_url,
        custom_message: `Welcome, ${staffProfileMap[s.user_id] || 'Staff'}!`,
        access_allowed: true,
        person_name: staffProfileMap[s.user_id] || 'Staff',
        is_staff: true,
      }));

      // Update device last_sync
      await supabase
        .from('access_devices')
        .update({ last_sync: new Date().toISOString() })
        .eq('id', device_id);

      return new Response(
        JSON.stringify({
          device_id,
          mode: 'full',
          members: [...roster, ...staffRoster],
          count: roster.length + staffRoster.length,
          server_time: new Date().toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === INCREMENTAL MODE (default) ===
    const { data: pendingSyncs, error: syncError } = await supabase
      .from('biometric_sync_queue')
      .select('*')
      .eq('device_id', device_id)
      .eq('status', 'pending')
      .order('queued_at', { ascending: true })
      .limit(limit);

    if (syncError) {
      console.error('Sync query error:', syncError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sync items' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark items as syncing
    if (pendingSyncs && pendingSyncs.length > 0) {
      const ids = pendingSyncs.map(s => s.id);
      await supabase
        .from('biometric_sync_queue')
        .update({ status: 'syncing' })
        .in('id', ids);
    }

    // Get wiegand_code and custom_welcome_message for each member in sync queue
    const memberIdsInQueue = [...new Set((pendingSyncs || []).map(s => s.member_id).filter(Boolean))];
    let memberHardwareMap: Record<string, { wiegand_code?: string; custom_welcome_message?: string }> = {};
    if (memberIdsInQueue.length > 0) {
      const { data: memberData } = await supabase
        .from('members')
        .select('id, wiegand_code, custom_welcome_message')
        .in('id', memberIdsInQueue);
      memberHardwareMap = (memberData || []).reduce((acc: Record<string, any>, m: any) => {
        acc[m.id] = { wiegand_code: m.wiegand_code, custom_welcome_message: m.custom_welcome_message };
        return acc;
      }, {});
    }

    // Transform to response format
    const syncItems: SyncItem[] = (pendingSyncs || []).map(item => ({
      id: item.id,
      person_uuid: item.person_uuid,
      person_name: item.person_name,
      photo_url: item.photo_url,
      action: item.sync_type as 'add' | 'update' | 'delete',
      wiegand_code: item.member_id ? memberHardwareMap[item.member_id]?.wiegand_code || undefined : undefined,
      custom_message: item.member_id ? memberHardwareMap[item.member_id]?.custom_welcome_message || undefined : undefined,
    }));

    // Update device last_sync timestamp
    await supabase
      .from('access_devices')
      .update({ last_sync: new Date().toISOString() })
      .eq('id', device_id);

    return new Response(
      JSON.stringify({
        device_id,
        mode: 'incremental',
        items: syncItems,
        count: syncItems.length,
        server_time: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync data error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
