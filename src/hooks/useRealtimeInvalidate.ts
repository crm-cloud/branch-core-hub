import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type Options = {
  /** Unique channel name for this page (e.g. 'page-attendance'). */
  channel: string;
  /** Public-schema table names to listen to. */
  tables: string[];
  /**
   * Query keys to invalidate on any change. Each entry is treated as a
   * key prefix — TanStack Query invalidates all queries whose key starts
   * with this array.
   */
  invalidateKeys: QueryKey[];
  /** Disable subscription (e.g. while user/branch isn't ready). */
  enabled?: boolean;
  /** Coalesce bursty events. Default 250 ms. */
  debounceMs?: number;
};

/**
 * Subscribes to Postgres changes on the given tables and invalidates the
 * supplied TanStack Query keys whenever a change arrives. One channel per
 * page; auto cleans up on unmount.
 *
 * Tables MUST be members of the `supabase_realtime` publication for events
 * to flow. See the migration that adds the operational tables to it.
 */
export function useRealtimeInvalidate({
  channel,
  tables,
  invalidateKeys,
  enabled = true,
  debounceMs = 250,
}: Options) {
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || tables.length === 0) return;

    const flush = () => {
      timer.current = null;
      for (const key of invalidateKeys) {
        qc.invalidateQueries({ queryKey: key });
      }
    };
    const scheduleFlush = () => {
      if (timer.current) return;
      timer.current = setTimeout(flush, debounceMs);
    };

    let ch = supabase.channel(channel);
    for (const table of tables) {
      ch = ch.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        scheduleFlush,
      );
    }
    ch.subscribe();

    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      try { supabase.removeChannel(ch); } catch { /* ignore */ }
    };
    // We intentionally re-subscribe when the *identity* of these inputs changes.
    // Pages should pass stable arrays (module-level const or useMemo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, enabled, debounceMs, qc, tables.join('|'), invalidateKeys.map(k => JSON.stringify(k)).join('|')]);
}
