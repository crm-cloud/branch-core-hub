import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBranchContext } from '@/contexts/BranchContext';

interface Args { term: string; enabled?: boolean }

const baseKey = (entity: string, term: string, branch?: string) =>
  ['cmdk', entity, term, branch ?? 'visible'] as const;

const STALE = 30_000;

function useGuard() {
  const { hasAnyRole, hasRole } = useAuth();
  const { branchFilter } = useBranchContext();
  return { hasAnyRole, hasRole, branchFilter };
}

export function useMembersSearch({ term, enabled = true }: Args) {
  const { hasAnyRole, branchFilter } = useGuard();
  const allowed = hasAnyRole(['owner','admin','manager','staff','trainer']);
  return useQuery({
    queryKey: baseKey('members', term, branchFilter),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_command_members', {
        search_term: term, p_branch_id: branchFilter ?? null, p_limit: 8,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: enabled && allowed && term.length >= 2,
    staleTime: STALE,
  });
}

export function useInvoicesSearch({ term, enabled = true }: Args) {
  const { hasAnyRole, branchFilter } = useGuard();
  const allowed = hasAnyRole(['owner','admin','manager','staff','member']);
  return useQuery({
    queryKey: baseKey('invoices', term, branchFilter),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_command_invoices', {
        search_term: term, p_branch_id: branchFilter ?? null, p_limit: 8,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: enabled && allowed && term.length >= 2,
    staleTime: STALE,
  });
}

export function useLeadsSearch({ term, enabled = true }: Args) {
  const { hasAnyRole, branchFilter } = useGuard();
  const allowed = hasAnyRole(['owner','admin','manager','staff']);
  return useQuery({
    queryKey: baseKey('leads', term, branchFilter),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_command_leads', {
        search_term: term, p_branch_id: branchFilter ?? null, p_limit: 8,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: enabled && allowed && term.length >= 2,
    staleTime: STALE,
  });
}

export function useTrainersSearch({ term, enabled = true }: Args) {
  const { hasAnyRole, branchFilter } = useGuard();
  const allowed = hasAnyRole(['owner','admin','manager','staff','trainer']);
  return useQuery({
    queryKey: baseKey('trainers', term, branchFilter),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_command_trainers', {
        search_term: term, p_branch_id: branchFilter ?? null, p_limit: 6,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: enabled && allowed && term.length >= 2,
    staleTime: STALE,
  });
}

export function usePaymentsSearch({ term, enabled = true }: Args) {
  const { hasAnyRole, branchFilter } = useGuard();
  const allowed = hasAnyRole(['owner','admin','manager','staff']);
  return useQuery({
    queryKey: baseKey('payments', term, branchFilter),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_command_payments', {
        search_term: term, p_branch_id: branchFilter ?? null, p_limit: 6,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: enabled && allowed && term.length >= 2,
    staleTime: STALE,
  });
}

export function useBookingsSearch({ term, enabled = true }: Args) {
  const { hasAnyRole, branchFilter } = useGuard();
  const allowed = hasAnyRole(['owner','admin','manager','staff','trainer']);
  return useQuery({
    queryKey: baseKey('bookings', term, branchFilter),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_command_bookings', {
        search_term: term, p_branch_id: branchFilter ?? null, p_limit: 8,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: enabled && allowed && term.length >= 2,
    staleTime: STALE,
  });
}

export function useTasksSearch({ term, enabled = true }: Args) {
  const { hasAnyRole, branchFilter } = useGuard();
  const allowed = hasAnyRole(['owner','admin','manager','staff','trainer']);
  return useQuery({
    queryKey: baseKey('tasks', term, branchFilter),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_command_tasks', {
        search_term: term, p_branch_id: branchFilter ?? null, p_limit: 6,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: enabled && allowed && term.length >= 2,
    staleTime: STALE,
  });
}
