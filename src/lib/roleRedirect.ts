import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserRoleInfo {
  role: AppRole;
  branch_id?: string;
}

const ADMIN_ROLES: AppRole[] = ['owner', 'admin', 'manager'];

function hasAdminRole(roles: UserRoleInfo[]): boolean {
  return roles.some(r => ADMIN_ROLES.includes(r.role));
}

/**
 * Centralized role-based home path resolution.
 * Single source of truth — used by DashboardRedirect, ProtectedRoute, Auth, SetPassword, Unauthorized.
 */
export function getHomePath(roles: UserRoleInfo[]): string {
  if (roles.length === 0) return '/auth';

  // Member is an exclusive role
  if (roles.some(r => r.role === 'member')) return '/member-dashboard';

  // Trainer without admin privileges
  if (roles.some(r => r.role === 'trainer') && !hasAdminRole(roles)) return '/trainer-dashboard';

  // Staff without admin privileges
  if (roles.some(r => r.role === 'staff') && !hasAdminRole(roles)) return '/staff-dashboard';

  // Admin, Manager, Owner → main dashboard
  return '/dashboard';
}
