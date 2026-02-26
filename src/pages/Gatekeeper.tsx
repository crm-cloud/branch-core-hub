import { useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBranchContext } from '@/contexts/BranchContext';
import { GymLoader } from '@/components/ui/gym-loader';

/**
 * Gatekeeper: central post-login router.
 * Checks roles + branch assignment before allowing dashboard access.
 */
export default function Gatekeeper() {
  const { user, roles, isLoading: authLoading, mustSetPassword } = useAuth();
  const { branches, isLoading: branchLoading, setSelectedBranch } = useBranchContext();

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

    // Must set password first
    if (mustSetPassword) return '/auth/set-password';

    // No roles assigned → pending approval
    if (roles.length === 0) return '/pending-approval';

    const isOwnerOrAdmin = roles.some(r => ['owner', 'admin'].includes(r.role));
    const isManager = roles.some(r => r.role === 'manager');
    const isMember = roles.some(r => r.role === 'member');
    const isTrainer = roles.some(r => r.role === 'trainer') && !isOwnerOrAdmin && !isManager;
    const isStaff = roles.some(r => r.role === 'staff') && !isOwnerOrAdmin && !isManager;

    // Member → member dashboard
    if (isMember) return '/member-dashboard';

    // Trainer → trainer dashboard
    if (isTrainer) return '/trainer-dashboard';

    // Staff → staff dashboard
    if (isStaff) {
      // Staff must have a branch assigned
      if (branches.length === 0 && !branchLoading) return '/pending-approval';
      return '/staff-dashboard';
    }

    // Manager with multiple branches → branch splash (mandatory)
    if (isManager && !isOwnerOrAdmin) {
      if (branches.length === 0 && !branchLoading) return '/pending-approval';
      const savedBranch = sessionStorage.getItem('current_branch_id');
      if (branches.length > 1 && !savedBranch) return '/select-branch';
      return '/dashboard';
    }

    // Owner/Admin → dashboard directly
    if (isOwnerOrAdmin) return '/dashboard';

    // Fallback
    return '/pending-approval';
  }, [isLoading, user, roles, branches, branchLoading, mustSetPassword]);

  if (isLoading || !destination) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <GymLoader text="Preparing your dashboard..." />
      </div>
    );
  }

  return <Navigate to={destination} replace />;
}
