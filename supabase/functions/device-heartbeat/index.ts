import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HeartbeatRequest {
  device_id: string;
  ip_address?: string;
  firmware_version?: string;
  status?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { device_id, device_sn, ip_address, firmware_version, status } = body;

    if (!device_id && !device_sn) {
      return new Response(
        JSON.stringify({ error: 'device_id or device_sn is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update device heartbeat
    const updateData: Record<string, unknown> = {
      is_online: true,
      last_heartbeat: new Date().toISOString(),
    };

    if (ip_address) {
      updateData.ip_address = ip_address;
    }

    if (firmware_version) {
      updateData.firmware_version = firmware_version;
    }

    if (status) {
      updateData.config = status;
    }

    // Support both UUID and serial number lookup
    let query = supabase.from('access_devices').update(updateData);
    if (device_sn) {
      query = query.eq('serial_number', device_sn);
    } else {
      query = query.eq('id', device_id);
    }
    const { data, error } = await query.select().single();

    if (error) {
      console.error('Heartbeat update error:', error);
      return new Response(
        JSON.stringify({ error: 'Device not found or update failed' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for pending sync items for this device
    const { data: pendingSyncs } = await supabase
      .from('biometric_sync_queue')
      .select('id')
      .eq('device_id', data.id)
      .eq('status', 'pending')
      .limit(1);

    // Fetch and return pending commands
    const { data: pendingCmds } = await supabase
      .from('device_commands')
      .select('*')
      .eq('device_id', data.id)
      .eq('status', 'pending')
      .order('issued_at', { ascending: true })
      .limit(10);

    const commands = (pendingCmds || []).map((cmd: any) => ({
      id: cmd.id,
      command: cmd.command_type,
      payload: cmd.payload,
    }));

    // Mark returned commands as executed
    if (commands.length > 0) {
      const ids = commands.map((c: any) => c.id);
      await supabase
        .from('device_commands')
        .update({ status: 'executed', executed_at: new Date().toISOString() })
        .in('id', ids);
    }

    return new Response(
      JSON.stringify({
        success: true,
        device_id: data.id,
        has_pending_syncs: pendingSyncs && pendingSyncs.length > 0,
        commands,
        server_time: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Heartbeat error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
