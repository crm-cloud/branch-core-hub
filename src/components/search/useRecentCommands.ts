import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface RecentCommand {
  kind: string; // 'member' | 'invoice' | 'lead' | 'page' | 'action' | ...
  id: string;
  label: string;
  sublabel?: string;
  route: string;
  ts: number;
}

const MAX = 8;

export function useRecentCommands() {
  const { user } = useAuth();
  const storageKey = user?.id ? `cmdk:recent:${user.id}` : null;
  const [items, setItems] = useState<RecentCommand[]>([]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, [storageKey]);

  const push = useCallback(
    (entry: Omit<RecentCommand, 'ts'>) => {
      if (!storageKey) return;
      setItems((prev) => {
        const next = [
          { ...entry, ts: Date.now() },
          ...prev.filter((e) => !(e.kind === entry.kind && e.id === entry.id)),
        ].slice(0, MAX);
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [storageKey]
  );

  const clear = useCallback(() => {
    if (!storageKey) return;
    setItems([]);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return { items, push, clear };
}
