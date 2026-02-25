import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { GymLoader } from '@/components/ui/gym-loader';

/**
 * Smart dashboard redirect component that routes users to the appropriate dashboard
 * based on their role hierarchy.
 */
export function DashboardRedirect() {
  const { roles, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <GymLoader text="Loading your dashboard..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Handle users with no roles - redirect to auth to avoid access denied loop
  if (roles.length === 0) {
    console.warn('User has no roles assigned, redirecting to auth');
    return <Navigate to="/auth" replace />;
  }

  // Priority: member gets member dashboard (exclusive role)
  if (roles.some(r => r.role === 'member')) {
    return <Navigate to="/member-dashboard" replace />;
  }

  // Trainer without admin privileges gets trainer dashboard
  if (roles.some(r => r.role === 'trainer') && 
      !roles.some(r => ['owner', 'admin', 'manager'].includes(r.role))) {
    return <Navigate to="/trainer-dashboard" replace />;
  }

  // Staff without admin privileges gets staff dashboard
  if (roles.some(r => r.role === 'staff') && 
      !roles.some(r => ['owner', 'admin', 'manager'].includes(r.role))) {
    return <Navigate to="/staff-dashboard" replace />;
  }

  // Admin, Manager, Owner -> main dashboard
  return <Navigate to="/dashboard" replace />;
}
