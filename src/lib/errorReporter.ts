// Frontend error reporter — pipes uncaught errors and ErrorBoundary failures to
// the unified error_logs table via log_error_event RPC.
import { supabase } from '@/integrations/supabase/client';

const RELEASE_SHA = (import.meta.env.VITE_RELEASE_SHA as string) || 'dev';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export async function reportError(
  message: string,
  opts: {
    severity?: ErrorSeverity;
    stack?: string | null;
    route?: string | null;
    context?: Record<string, unknown> | null;
    branchId?: string | null;
  } = {},
) {
  try {
    const { data: userResult } = await supabase.auth.getUser();
    await (supabase.rpc as any)('log_error_event', {
      p_severity: opts.severity || 'error',
      p_source: 'frontend',
      p_message: String(message).slice(0, 2000),
      p_function_name: null,
      p_route: opts.route || (typeof window !== 'undefined' ? window.location.pathname : null),
      p_table_name: null,
      p_branch_id: opts.branchId || null,
      p_user_id: userResult?.user?.id || null,
      p_request_id: null,
      p_release_sha: RELEASE_SHA,
      p_stack: opts.stack || null,
      p_context: opts.context || null,
    });
  } catch {
    /* never throw from reporter */
  }
}

let installed = false;
export function installGlobalErrorReporter() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (e) => {
    reportError(e.message || 'window.onerror', {
      severity: 'error',
      stack: e.error?.stack || null,
      context: { filename: e.filename, lineno: e.lineno, colno: e.colno },
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason: any = e.reason;
    reportError(reason?.message || String(reason || 'unhandledrejection'), {
      severity: 'error',
      stack: reason?.stack || null,
      context: { kind: 'unhandledrejection' },
    });
  });
}
