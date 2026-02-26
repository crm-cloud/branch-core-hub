import { Navigate } from 'react-router-dom';

/**
 * Legacy redirect — now just points to Gatekeeper.
 */
export function DashboardRedirect() {
  return <Navigate to="/home" replace />;
}
