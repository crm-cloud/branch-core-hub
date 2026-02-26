import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import type { Database } from '@/integrations/supabase/types';
import { GymLoader } from '@/components/ui/gym-loader';

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
  const { isViewingAs } = useViewAs();
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
    // Admin/owner using View As mode can access any route
    const isAdminOrOwner = roles.some(r => ['owner', 'admin'].includes(typeof r === 'string' ? r : r.role));
    if (isViewingAs && isAdminOrOwner) {
      return <>{children}</>;
    }

    if (!hasAnyRole(requiredRoles)) {
      // Instead of showing unauthorized, redirect to appropriate dashboard
      // This provides a smoother UX
      
      // Member trying to access non-member routes
      if (roles.some(r => r.role === 'member')) {
        return <Navigate to="/member-dashboard" replace />;
      }
      
      // Trainer trying to access non-trainer routes (without admin privileges)
      if (roles.some(r => r.role === 'trainer') && 
          !roles.some(r => ['owner', 'admin', 'manager'].includes(r.role))) {
        return <Navigate to="/trainer-dashboard" replace />;
      }
      
      // Staff or admin trying to access higher-level routes
      if (roles.some(r => ['owner', 'admin', 'manager', 'staff'].includes(r.role))) {
        return <Navigate to="/dashboard" replace />;
      }
      
      // Fallback to unauthorized page
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}
