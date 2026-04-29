// v1.0.0 - Log edge function errors to error_logs for live System Health monitoring
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({}));
    const {
      function_name,
      error_message,
      stack_trace,
      severity = 'error',
      context = null,
      branch_id = null,
      user_id = null,
    } = body || {};

    if (!function_name || !error_message) {
      return new Response(
        JSON.stringify({ error: 'function_name and error_message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { error } = await (supabase.from('error_logs') as any).insert({
      source: 'edge_function',
      route: `/functions/v1/${function_name}`,
      error_message: String(error_message).slice(0, 2000),
      stack_trace: stack_trace ? String(stack_trace).slice(0, 8000) : null,
      severity,
      context,
      branch_id,
      user_id,
      status: 'open',
    });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('log-edge-error failed:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
