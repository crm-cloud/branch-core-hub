import { createContext, useContext, useState, useMemo, useEffect, ReactNode } from 'react';
import { useBranches } from '@/hooks/useBranches';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface BranchContextType {
  selectedBranch: string;
  setSelectedBranch: (id: string) => void;
  effectiveBranchId: string | undefined;
  branchFilter: string | undefined;
  branches: Array<{ id: string; name: string; code: string; [key: string]: any }>;
  isLoading: boolean;
  /** Whether the branch selector should be visible */
  showSelector: boolean;
  /** Whether the "All Branches" option should be available */
  showAllOption: boolean;
  /** Whether branch context is fully initialized and ready */
  branchReady: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const { data: allBranches = [], isLoading: branchesLoading } = useBranches();
  const { user, roles, hasAnyRole } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [initialized, setInitialized] = useState(false);

  const isOwnerOrAdmin = hasAnyRole(['owner', 'admin']);
  const isManager = hasAnyRole(['manager']);
  const isStaffOrTrainerOrMember = hasAnyRole(['staff', 'trainer', 'member']);

  // For managers: fetch their assigned branches from staff_branches
  const { data: managerBranches = [] } = useQuery({
    queryKey: ['manager-branches', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('staff_branches')
        .select('branch_id, branches(id, name, code)')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data || [])
        .map((sb: any) => sb.branches)
        .filter(Boolean);
    },
    enabled: !!user?.id && isManager && !isOwnerOrAdmin,
  });

  // For staff/trainer: fetch their branch from employees/trainers
  const { data: staffBranch } = useQuery({
    queryKey: ['staff-home-branch', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: emp } = await supabase
        .from('employees')
        .select('branch_id, branches(id, name, code)')
        .eq('user_id', user.id)
        .maybeSingle();
      if (emp?.branches) return emp.branches as any;
      const { data: trainer } = await supabase
        .from('trainers')
        .select('branch_id, branches(id, name, code)')
        .eq('user_id', user.id)
        .maybeSingle();
      if (trainer?.branches) return trainer.branches as any;
      return null;
    },
    enabled: !!user?.id && (hasAnyRole(['staff', 'trainer'])) && !isOwnerOrAdmin && !isManager,
  });

  // For members: fetch their branch
  const { data: memberBranch } = useQuery({
    queryKey: ['member-home-branch', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('members')
        .select('branch_id, branches:branch_id(id, name, code)')
        .eq('user_id', user.id)
        .maybeSingle();
      return (data as any)?.branches || null;
    },
    enabled: !!user?.id && hasAnyRole(['member']) && !isOwnerOrAdmin && !isManager && !hasAnyRole(['staff', 'trainer']),
  });

  // Determine the effective branch list based on role
  const branches = useMemo(() => {
    if (isOwnerOrAdmin) return allBranches;
    if (isManager && !isOwnerOrAdmin) return managerBranches;
    if (staffBranch) return [staffBranch];
    if (memberBranch) return [memberBranch];
    return allBranches; // fallback
  }, [isOwnerOrAdmin, isManager, allBranches, managerBranches, staffBranch, memberBranch]);

  const showSelector = useMemo(() => {
    if (isOwnerOrAdmin) return true;
    if (isManager && !isOwnerOrAdmin && managerBranches.length > 1) return true;
    return false;
  }, [isOwnerOrAdmin, isManager, managerBranches]);

  const showAllOption = isOwnerOrAdmin;

  // Auto-initialize branch selection for restricted roles
  useEffect(() => {
    if (initialized) return;

    if (isOwnerOrAdmin) {
      // Restore saved branch for admin/owner too
      const saved = sessionStorage.getItem('current_branch_id');
      if (saved && allBranches.some(b => b.id === saved)) {
        setSelectedBranch(saved);
      }
      setInitialized(true);
      return;
    }

    if (isManager && !isOwnerOrAdmin && managerBranches.length > 0) {
      const saved = sessionStorage.getItem('current_branch_id');
      if (saved && managerBranches.some((b: any) => b.id === saved)) {
        setSelectedBranch(saved);
      } else {
        setSelectedBranch(managerBranches[0].id);
      }
      setInitialized(true);
    }

    if (staffBranch) {
      setSelectedBranch(staffBranch.id);
      setInitialized(true);
    }

    if (memberBranch) {
      setSelectedBranch(memberBranch.id);
      setInitialized(true);
    }
  }, [isOwnerOrAdmin, isManager, managerBranches, staffBranch, memberBranch, initialized, allBranches]);

  const isLoading = branchesLoading;

  // effectiveBranchId: never 'all' for non-admin roles
  const effectiveBranchId = useMemo(() => {
    if (selectedBranch !== 'all') return selectedBranch;
    // For owner/admin, fall back to first branch if available
    if (isOwnerOrAdmin && branches.length > 0) return branches[0].id;
    // For other roles, this shouldn't happen but guard anyway
    if (branches.length > 0) return branches[0].id;
    return undefined;
  }, [selectedBranch, branches, isOwnerOrAdmin]);

  const branchFilter = useMemo(() => {
    return selectedBranch !== 'all' ? selectedBranch : undefined;
  }, [selectedBranch]);

  const branchReady = initialized && !branchesLoading;

  // Persist branch selection
  const handleSetBranch = (id: string) => {
    setSelectedBranch(id);
    if (id !== 'all') {
      sessionStorage.setItem('current_branch_id', id);
    }
  };

  return (
    <BranchContext.Provider value={{
      selectedBranch,
      setSelectedBranch: handleSetBranch,
      effectiveBranchId,
      branchFilter,
      branches,
      isLoading,
      showSelector,
      showAllOption,
      branchReady,
    }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranchContext() {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranchContext must be used within a BranchProvider');
  }
  return context;
}
