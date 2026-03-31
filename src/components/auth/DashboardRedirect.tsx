import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { GymLoader } from '@/components/ui/gym-loader';
import { getHomePath } from '@/lib/roleRedirect';

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

  return <Navigate to={getHomePath(roles)} replace />;
}
