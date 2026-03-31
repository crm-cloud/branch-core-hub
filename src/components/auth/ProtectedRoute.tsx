import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';
import { GymLoader } from '@/components/ui/gym-loader';
import { getHomePath } from '@/lib/roleRedirect';

type AppRole = Database['public']['Enums']['app_role'];

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: AppRole[];
}

/**
 * ProtectedRoute component that handles authentication and role-based access control.
 */
export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, isLoading, mustSetPassword, hasAnyRole, roles } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <GymLoader text="Loading..." />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Must set password on first login
  if (mustSetPassword && location.pathname !== '/auth/set-password') {
    return <Navigate to="/auth/set-password" replace />;
  }

  // Check role requirements
  if (requiredRoles && requiredRoles.length > 0) {
    if (!hasAnyRole(requiredRoles)) {
      // Redirect to role-appropriate dashboard instead of showing unauthorized
      const homePath = getHomePath(roles);
      if (location.pathname !== homePath) {
        return <Navigate to={homePath} replace />;
      }
      // Fallback to unauthorized page
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}
