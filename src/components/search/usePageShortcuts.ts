import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getMenuForRole, type MenuItem } from '@/config/menu';

/**
 * Build flat list of pages the current user can navigate to,
 * derived from the existing role-aware menu config (no hardcoding).
 */
export function usePageShortcuts(query: string) {
  const { roles } = useAuth();

  const allItems = useMemo<MenuItem[]>(() => {
    const sections = getMenuForRole(roles);
    return sections.flatMap((s) => s.items);
  }, [roles]);

  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems.slice(0, 8);
    return allItems
      .filter((i) => i.label.toLowerCase().includes(q) || i.href.toLowerCase().includes(q))
      .slice(0, 10);
  }, [allItems, query]);
}
