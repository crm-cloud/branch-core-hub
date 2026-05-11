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

// Singleton channel + listeners so the heartbeat (which tracks) and any
// number of `useOnlineUsers` consumers share a single realtime subscription
// and a single source of truth.
type State = {
  channel: ReturnType<typeof supabase.channel> | null;
  users: OnlineUser[];
  listeners: Set<(u: OnlineUser[]) => void>;
  refCount: number;
  currentKey: string | null;
};

const state: State = {
  channel: null,
  users: [],
  listeners: new Set(),
  refCount: 0,
  currentKey: null,
};

function emit() {
  for (const cb of state.listeners) cb(state.users);
}

function syncFromChannel() {
  if (!state.channel) return;
  const presenceState = state.channel.presenceState() as Record<string, OnlineUser[]>;
  const flat: OnlineUser[] = [];
  const seen = new Set<string>();
  for (const arr of Object.values(presenceState)) {
    for (const p of arr) {
      if (!p?.user_id || seen.has(p.user_id)) continue;
      seen.add(p.user_id);
      flat.push(p);
    }
  }
  state.users = flat;
  emit();
}

function ensureChannel(userId: string, track?: () => Promise<void> | void) {
  // If user changed (rare), tear down and rebuild.
  if (state.channel && state.currentKey !== userId) {
    try { supabase.removeChannel(state.channel); } catch { /* ignore */ }
    state.channel = null;
    state.currentKey = null;
    state.users = [];
  }

  if (!state.channel) {
    state.currentKey = userId;
    const ch = supabase.channel(CHANNEL, { config: { presence: { key: userId } } });
    ch.on('presence', { event: 'sync' }, syncFromChannel)
      .on('presence', { event: 'join' }, syncFromChannel)
      .on('presence', { event: 'leave' }, syncFromChannel)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && track) {
          try { await track(); } catch { /* ignore */ }
          syncFromChannel();
        }
      });
    state.channel = ch;
  }
  return state.channel;
}

function releaseChannel() {
  state.refCount = Math.max(0, state.refCount - 1);
  if (state.refCount === 0 && state.channel) {
    try { supabase.removeChannel(state.channel); } catch { /* ignore */ }
    state.channel = null;
    state.currentKey = null;
    state.users = [];
    emit();
  }
}

/**
 * Mounts a global presence heartbeat. Joins the realtime presence channel and
 * pings touch_presence() RPC every 60s so we have a server-side fallback.
 */
export function usePresenceHeartbeat() {
  const { user, profile, roles } = useAuth();
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    const track = async () => {
      const ch = state.channel;
      if (!ch) return;
      await ch.track({
        user_id: user.id,
        full_name: profile?.full_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        roles: (roles || []).map((r: any) => r.role),
        online_at: new Date().toISOString(),
      });
      trackedRef.current = true;
    };

    state.refCount++;
    ensureChannel(user.id, track);

    // If channel was already up (another consumer mounted first), track now.
    if (state.channel && !trackedRef.current) {
      // Best-effort track — channel.subscribe may already be SUBSCRIBED.
      track().catch(() => {});
    }

    // Heartbeat to DB — best effort.
    const ping = async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) return;
        await supabase.rpc('touch_presence');
        // Re-track to refresh online_at and metadata.
        await track();
      } catch { /* ignore */ }
    };
    ping();
    const interval = setInterval(ping, 60_000);
    const onVisibility = () => { if (document.visibilityState === 'visible') ping(); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      trackedRef.current = false;
      releaseChannel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}

/** Subscribes to the shared channel and returns the deduped list of online users. */
export function useOnlineUsers(): OnlineUser[] {
  const { user } = useAuth();
  const [users, setUsers] = useState<OnlineUser[]>(state.users);

  useEffect(() => {
    if (!user) { setUsers([]); return; }
    state.refCount++;
    ensureChannel(user.id);
    const cb = (u: OnlineUser[]) => setUsers(u);
    state.listeners.add(cb);
    // Push current snapshot immediately.
    setUsers(state.users);
    return () => {
      state.listeners.delete(cb);
      releaseChannel();
    };
  }, [user?.id]);

  return users;
}
