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

    const body: HeartbeatRequest = await req.json();
    const { device_id, ip_address, firmware_version, status } = body;

    if (!device_id) {
      return new Response(
        JSON.stringify({ error: 'device_id is required' }),
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

    const { data, error } = await supabase
      .from('access_devices')
      .update(updateData)
      .eq('id', device_id)
      .select()
      .single();

    if (error) {
      console.error('Heartbeat update error:', error);
      return new Response(
        JSON.stringify({ error: 'Device not found or update failed' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for pending sync items for this device
    const { data: pendingSyncs, error: syncError } = await supabase
      .from('biometric_sync_queue')
      .select('id')
      .eq('device_id', device_id)
      .eq('status', 'pending')
      .limit(1);

    return new Response(
      JSON.stringify({
        success: true,
        device_id: data.id,
        has_pending_syncs: pendingSyncs && pendingSyncs.length > 0,
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
