import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });
}

export function useBranch(branchId: string) {
  return useQuery({
    queryKey: ['branch', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('id', branchId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });
}

export function useUserBranch(userId: string) {
  return useQuery({
    queryKey: ['userBranch', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_branches')
        .select('branch_id, branches(*)')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}