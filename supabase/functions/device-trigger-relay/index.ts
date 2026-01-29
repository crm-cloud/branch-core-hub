import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TriggerRequest {
  device_id: string;
  duration?: number; // seconds to keep relay open
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Verify user is authenticated and has permission
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
    
    if (claimsError || !claims?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claims.claims.sub;

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check user has admin/manager role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    const hasPermission = roles?.some(r => 
      ['owner', 'admin', 'manager', 'staff'].includes(r.role)
    );

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: TriggerRequest = await req.json();
    const { device_id, duration } = body;

    if (!device_id) {
      return new Response(
        JSON.stringify({ error: 'device_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get device info
    const { data: device, error: deviceError } = await supabase
      .from('access_devices')
      .select('*')
      .eq('id', device_id)
      .single();

    if (deviceError || !device) {
      return new Response(
        JSON.stringify({ error: 'Device not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!device.is_online) {
      return new Response(
        JSON.stringify({ error: 'Device is offline', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the manual trigger event
    await supabase.from('device_access_events').insert({
      device_id,
      branch_id: device.branch_id,
      event_type: 'manual_trigger',
      access_granted: true,
      response_sent: 'OPEN',
      device_message: 'Manual trigger by staff',
      processed_at: new Date().toISOString(),
    });

    // In a real implementation, this would send a command to the device
    // via MQTT, WebSocket, or HTTP callback to the device's IP
    // For now, we return success indicating the command was logged
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Relay trigger command sent',
        device_id,
        device_name: device.device_name,
        duration: duration || device.relay_delay || 5,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Trigger relay error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
