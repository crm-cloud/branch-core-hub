import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncItem {
  id: string;
  person_uuid: string;
  person_name: string;
  photo_url: string;
  action: 'add' | 'update' | 'delete';
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

    // Get pending sync items for this device
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

    // Transform to response format
    const syncItems: SyncItem[] = (pendingSyncs || []).map(item => ({
      id: item.id,
      person_uuid: item.person_uuid,
      person_name: item.person_name,
      photo_url: item.photo_url,
      action: item.sync_type as 'add' | 'update' | 'delete',
    }));

    // Update device last_sync timestamp
    await supabase
      .from('access_devices')
      .update({ last_sync: new Date().toISOString() })
      .eq('id', device_id);

    return new Response(
      JSON.stringify({
        device_id,
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
