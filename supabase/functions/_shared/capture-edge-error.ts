// v1.0.0 - Shared helper for edge functions to forward errors to log-edge-error
// Usage:
//   import { captureEdgeError } from '../_shared/capture-edge-error.ts'
//   try { ... } catch (e) { await captureEdgeError('my-fn', e, { branch_id }); throw e; }

export interface CaptureContext {
  branch_id?: string | null;
  user_id?: string | null;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  context?: Record<string, unknown> | null;
}

export async function captureEdgeError(
  functionName: string,
  error: unknown,
  ctx: CaptureContext = {},
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return;

    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : null;

    // Fire-and-forget POST to log-edge-error (never let logging break the caller)
    await fetch(`${supabaseUrl}/functions/v1/log-edge-error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        function_name: functionName,
        error_message: message,
        stack_trace: stack,
        severity: ctx.severity || 'error',
        context: ctx.context || null,
        branch_id: ctx.branch_id || null,
        user_id: ctx.user_id || null,
      }),
    }).catch(() => { /* swallow */ });
  } catch {
    // Never throw from logging
  }
}
