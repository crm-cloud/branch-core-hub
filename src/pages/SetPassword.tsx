import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SetPasswordForm } from '@/components/auth/SetPasswordForm';

export default function SetPasswordPage() {
  const { user, isLoading, mustSetPassword } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-hero)' }}>
        <div className="animate-pulse text-accent">Loading...</div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Already set password
  if (!mustSetPassword) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'var(--gradient-hero)' }}
    >
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary-foreground tracking-tight">
            <span className="text-gradient">Incline</span>
          </h1>
        </div>

        <SetPasswordForm />
      </div>
    </div>
  );
}