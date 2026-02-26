import { useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBranchContext } from '@/contexts/BranchContext';
import { GymLoader } from '@/components/ui/gym-loader';

/**
 * Gatekeeper: central post-login router.
 * Checks roles + branch assignment before allowing dashboard access.
 * Priority: owner/admin > manager > staff > trainer > member
 */
export default function Gatekeeper() {
  const { user, roles, isLoading: authLoading, mustSetPassword } = useAuth();
  const { branches, isLoading: branchLoading, branchReady, setSelectedBranch } = useBranchContext();

  const isLoading = authLoading || branchLoading;

  // Restore last branch for managers
  useEffect(() => {
    const saved = sessionStorage.getItem('current_branch_id');
    if (saved && branches.some(b => b.id === saved)) {
      setSelectedBranch(saved);
    }
  }, [branches, setSelectedBranch]);

  const destination = useMemo(() => {
    if (isLoading || !user) return null;
    // Wait for branch context to be ready before evaluating
    if (!branchReady) return null;

    // Must set password first
    if (mustSetPassword) return '/auth/set-password';

    // No roles assigned → pending approval
    if (roles.length === 0) return '/pending-approval';

    const isOwnerOrAdmin = roles.some(r => ['owner', 'admin'].includes(r.role));
    const isManager = roles.some(r => r.role === 'manager');

    // 1. Owner/Admin → dashboard directly (highest priority)
    if (isOwnerOrAdmin) return '/dashboard';

    // 2. Manager (non-admin) → branch splash if multiple
    if (isManager) {
      if (branches.length === 0) return '/pending-approval';
      const savedBranch = sessionStorage.getItem('current_branch_id');
      if (branches.length > 1 && !savedBranch) return '/select-branch';
      return '/dashboard';
    }

    // 3. Staff → staff dashboard
    const isStaff = roles.some(r => r.role === 'staff');
    if (isStaff) {
      if (branches.length === 0) return '/pending-approval';
      return '/staff-dashboard';
    }

    // 4. Trainer → trainer dashboard
    const isTrainer = roles.some(r => r.role === 'trainer');
    if (isTrainer) {
      if (branches.length === 0) return '/pending-approval';
      return '/trainer-dashboard';
    }

    // 5. Member → member dashboard (lowest priority)
    const isMember = roles.some(r => r.role === 'member');
    if (isMember) return '/member-dashboard';

    // Fallback
    return '/pending-approval';
  }, [isLoading, user, roles, branches, branchReady, mustSetPassword]);

  if (isLoading || !destination) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <GymLoader text="Preparing your dashboard..." />
      </div>
    );
  }

  return <Navigate to={destination} replace />;
}
