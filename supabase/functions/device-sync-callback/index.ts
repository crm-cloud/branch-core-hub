import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { sync_id, success, error_message } = body;

    if (!sync_id) {
      return new Response(
        JSON.stringify({ error: 'sync_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current sync item
    const { data: syncItem, error: fetchError } = await supabase
      .from('biometric_sync_queue')
      .select('id, member_id, staff_id, retry_count')
      .eq('id', sync_id)
      .single();

    if (fetchError || !syncItem) {
      return new Response(
        JSON.stringify({ error: 'Sync item not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updates: Record<string, unknown> = {
      status: success ? 'completed' : 'failed',
      processed_at: new Date().toISOString(),
    };

    if (!success && error_message) {
      updates.error_message = error_message;
      updates.retry_count = (syncItem.retry_count || 0) + 1;
    }

    const { error: updateError } = await supabase
      .from('biometric_sync_queue')
      .update(updates)
      .eq('id', sync_id);

    if (updateError) throw updateError;

    // Update enrollment status on success
    if (success) {
      if (syncItem.member_id) {
        await supabase.from('members').update({ biometric_enrolled: true }).eq('id', syncItem.member_id);
      } else if (syncItem.staff_id) {
        // Check if it's an employee or trainer
        const { data: employee } = await supabase.from('employees').select('id').eq('id', syncItem.staff_id).maybeSingle();
        if (employee) {
          await supabase.from('employees').update({ biometric_enrolled: true }).eq('id', syncItem.staff_id);
        } else {
          await supabase.from('trainers').update({ biometric_enrolled: true }).eq('id', syncItem.staff_id);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync callback error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
