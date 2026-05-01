import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';

/** Default callback URL derived from the current Supabase env (no project-ref hard-codes). */
function defaultMipsCallback(): string {
  if (!SUPABASE_URL) return '';
  return `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/mips-webhook-receiver`;
}

/**
 * Resolve the MIPS webhook receiver URL, preferring an explicit override
 * stored in `integration_settings` (provider=mips, integration_type=device).
 * Falls back to the env-derived default URL.
 */
export function useMipsCallbackUrls() {
  return useQuery({
    queryKey: ['mips-callback-urls'],
    queryFn: async () => {
      const { data } = await supabase
        .from('integration_settings')
        .select('config')
        .eq('integration_type', 'device')
        .eq('provider', 'mips')
        .is('branch_id', null)
        .maybeSingle();

      const config = (data?.config ?? {}) as Record<string, unknown>;
      const override = typeof config.callback_url === 'string' ? (config.callback_url as string) : '';
      const def = defaultMipsCallback();
      return {
        receiver: override || def,
        defaultUrl: def,
        isOverridden: Boolean(override) && override !== def,
      };
    },
    staleTime: 60_000,
  });
}
