import { Navigate } from 'react-router-dom';

// Marketing & Campaigns lives inside the Communication Hub now.
export default function Campaigns() {
  return <Navigate to="/announcements?tab=campaigns" replace />;
}
