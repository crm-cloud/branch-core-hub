import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * Smart dashboard redirect component that routes users to the appropriate dashboard
 * based on their role hierarchy.
 * 
 * Priority: member > trainer > staff > manager/admin/owner
 */
export function DashboardRedirect() {
  const { roles, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
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

  // Staff without admin privileges stays on staff-appropriate dashboard
  // Admin, Manager, Owner, or Staff with elevated privileges -> main dashboard
  return <Navigate to="/dashboard" replace />;
}
