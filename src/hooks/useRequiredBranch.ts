import { useBranchContext } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

/**
 * Fail-closed branch context for restricted roles.
 *
 * - Owners/admins: returns ready with branchId (or null when in "All branches"
 *   mode), allowing privileged unscoped reads.
 * - Manager/staff/trainer/member: MUST resolve to a concrete branchId. If no
 *   branch is selected, returns 'unavailable' so the UI can render the
 *   "Select a branch" empty state instead of issuing an unscoped query.
 *
 * Callers should gate scoped queries on `status === 'ready' && branchId`.
 */
export type RequiredBranchState =
  | { status: 'loading'; branchId: null; isPrivileged: false }
  | { status: 'unavailable'; branchId: null; reason: string; isPrivileged: false }
  | { status: 'ready'; branchId: string | null; isPrivileged: boolean };

export function useRequiredBranch(): RequiredBranchState {
  const { effectiveBranchId, isLoading: branchLoading, branchStatus } = useBranchContext();
  const { user, isLoading: authLoading, roles } = useAuth();

  return useMemo<RequiredBranchState>(() => {
    if (authLoading || branchLoading || branchStatus === 'loading') {
      return { status: 'loading', branchId: null, isPrivileged: false };
    }
    if (!user) {
      return { status: 'unavailable', branchId: null, isPrivileged: false, reason: 'Not authenticated' };
    }
    const roleSet = new Set((roles ?? []).map((r: { role: string }) => r.role));
    const isPrivileged = roleSet.has('owner') || roleSet.has('admin');

    if (effectiveBranchId) {
      return { status: 'ready', branchId: effectiveBranchId, isPrivileged };
    }
    if (isPrivileged) {
      return { status: 'ready', branchId: null, isPrivileged: true };
    }
    return {
      status: 'unavailable',
      branchId: null,
      isPrivileged: false,
      reason: 'No branch selected. Choose a branch to continue.',
    };
  }, [authLoading, branchLoading, branchStatus, user, roles, effectiveBranchId]);
}
