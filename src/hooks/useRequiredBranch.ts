import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

/**
 * Fail-closed branch context for restricted roles.
 *
 * - Owners/admins: returns { status: 'ready', branchId: currentBranch?.id ?? null }
 *   and may operate on "all branches" when branchId is null.
 * - Manager/staff/trainer/member: MUST have a current branch. Returns:
 *     { status: 'loading' } while auth/branch context resolves
 *     { status: 'unavailable' } if no branch is selected (UI should render
 *       the "Select a branch" empty state instead of issuing unscoped queries)
 *     { status: 'ready', branchId } otherwise
 *
 * Callers should gate scoped queries on `status === 'ready' && branchId`.
 */
export type RequiredBranchState =
  | { status: 'loading'; branchId: null }
  | { status: 'unavailable'; branchId: null; reason: string }
  | { status: 'ready'; branchId: string | null; isPrivileged: boolean };

export function useRequiredBranch(): RequiredBranchState {
  const { currentBranch, isLoading: branchLoading } = useBranch();
  const { user, loading: authLoading, roles } = useAuth();

  return useMemo<RequiredBranchState>(() => {
    if (authLoading || branchLoading) {
      return { status: 'loading', branchId: null };
    }
    if (!user) {
      return { status: 'unavailable', branchId: null, reason: 'Not authenticated' };
    }
    const roleSet = new Set((roles ?? []).map(r => r.role));
    const isPrivileged = roleSet.has('owner') || roleSet.has('admin');

    if (currentBranch?.id) {
      return { status: 'ready', branchId: currentBranch.id, isPrivileged };
    }
    if (isPrivileged) {
      // Owner / admin in "All branches" mode is allowed.
      return { status: 'ready', branchId: null, isPrivileged: true };
    }
    return {
      status: 'unavailable',
      branchId: null,
      reason: 'No branch selected. Choose a branch to continue.',
    };
  }, [authLoading, branchLoading, user, roles, currentBranch]);
}
