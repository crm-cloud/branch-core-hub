import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function AuthPage() {
  const { user, isLoading, mustSetPassword, roles } = useAuth();
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-setup');
        if (error) throw error;
        if (data?.needsSetup) {
          setNeedsSetup(true);
        }
      } catch (error) {
        console.error('Setup check failed:', error);
      } finally {
        setCheckingSetup(false);
      }
    };

    checkSetup();
  }, []);

  // Determine the correct redirect path based on user roles
  const getRedirectPath = () => {
    if (roles.some(r => r.role === 'member')) {
      return '/member-dashboard';
    }
    if (roles.some(r => r.role === 'trainer') && 
        !roles.some(r => ['owner', 'admin', 'manager'].includes(r.role))) {
      return '/trainer-dashboard';
    }
    return '/dashboard';
  };

  if (isLoading || checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-hero)' }}>
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // Redirect to setup if no owner exists
  if (needsSetup) {
    return <Navigate to="/setup" replace />;
  }

  // Already logged in - redirect to appropriate dashboard
  if (user && !mustSetPassword) {
    return <Navigate to={getRedirectPath()} replace />;
  }

  // Needs to set password
  if (user && mustSetPassword) {
    return <Navigate to="/auth/set-password" replace />;
  }

  // Handle successful login - redirect to appropriate dashboard
  const handleLoginSuccess = () => {
    // Use /home which will then redirect to the appropriate dashboard
    navigate('/home');
  };

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

        <LoginForm onSuccess={handleLoginSuccess} />

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
