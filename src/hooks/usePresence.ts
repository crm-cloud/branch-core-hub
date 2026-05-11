import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type OnlineUser = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  roles: string[];
  online_at: string;
};

const CHANNEL = 'presence:app';

/**
 * Mounts a global presence heartbeat. Joins the realtime presence channel and
 * pings touch_presence() RPC every 60s so we have a server-side fallback.
 */
export function usePresenceHeartbeat() {
  const { user, profile, roles } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(CHANNEL, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {})
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        await channel.track({
          user_id: user.id,
          full_name: profile?.full_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
          roles: (roles || []).map((r: any) => r.role),
          online_at: new Date().toISOString(),
        });
      });

    channelRef.current = channel;

    // Heartbeat to DB — swallow any auth/network errors so an expired session
    // can never bubble up into the global ErrorBoundary.
    const ping = async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) return;
        await supabase.rpc('touch_presence');
      } catch {
        // ignore — presence is best-effort
      }
    };
    ping();
    const interval = setInterval(ping, 60_000);
    const onVisibility = () => { if (document.visibilityState === 'visible') ping(); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      try { supabase.removeChannel(channel); } catch { /* ignore */ }
      channelRef.current = null;
    };
    // Intentionally only depend on user.id — profile/roles changes shouldn't
    // tear down and re-create the realtime channel every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}

/** Subscribes to the same channel and returns the deduped list of online users. */
export function useOnlineUsers(): OnlineUser[] {
  const { user } = useAuth();
  const [users, setUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!user) { setUsers([]); return; }
    const channel = supabase.channel(CHANNEL, { config: { presence: { key: user.id } } });

    const sync = () => {
      const state = channel.presenceState() as Record<string, OnlineUser[]>;
      const flat: OnlineUser[] = [];
      const seen = new Set<string>();
      for (const arr of Object.values(state)) {
        for (const p of arr) {
          if (!p?.user_id || seen.has(p.user_id)) continue;
          seen.add(p.user_id);
          flat.push(p);
        }
      }
      setUsers(flat);
    };

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return users;
}
