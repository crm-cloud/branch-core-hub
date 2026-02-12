import { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { useBranches } from '@/hooks/useBranches';

interface BranchContextType {
  selectedBranch: string;
  setSelectedBranch: (id: string) => void;
  /** Always resolves to a real branch ID (first branch when 'all' is selected). Use for create actions. */
  effectiveBranchId: string | undefined;
  /** undefined when 'all' is selected. Use for query filters. */
  branchFilter: string | undefined;
  branches: Array<{ id: string; name: string; code: string; [key: string]: any }>;
  isLoading: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const { data: branches = [], isLoading } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  const effectiveBranchId = useMemo(() => {
    if (selectedBranch !== 'all') return selectedBranch;
    return branches[0]?.id;
  }, [selectedBranch, branches]);

  const branchFilter = useMemo(() => {
    return selectedBranch !== 'all' ? selectedBranch : undefined;
  }, [selectedBranch]);

  return (
    <BranchContext.Provider value={{
      selectedBranch,
      setSelectedBranch,
      effectiveBranchId,
      branchFilter,
      branches,
      isLoading,
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
