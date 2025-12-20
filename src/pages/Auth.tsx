import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { OtpLoginForm } from '@/components/auth/OtpLoginForm';
import { Link } from 'react-router-dom';

export default function AuthPage() {
  const { user, isLoading, mustSetPassword } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-hero)' }}>
        <div className="animate-pulse text-accent">Loading...</div>
      </div>
    );
  }

  // Already logged in
  if (user && !mustSetPassword) {
    return <Navigate to="/dashboard" replace />;
  }

  // Needs to set password
  if (user && mustSetPassword) {
    return <Navigate to="/auth/set-password" replace />;
  }

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'var(--gradient-hero)' }}
    >
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary-foreground tracking-tight">
            <span className="text-gradient">Incline</span>
          </h1>
          <p className="mt-2 text-primary-foreground/70">Gym Management System</p>
        </div>

        <OtpLoginForm />

        <p className="text-center text-sm text-primary-foreground/60">
          Forgot your password?{' '}
          <Link to="/auth/forgot-password" className="text-accent hover:underline font-medium">
            Reset it here
          </Link>
        </p>
      </div>
    </div>
  );
}