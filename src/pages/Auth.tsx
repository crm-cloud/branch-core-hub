import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function AuthPage() {
  const { user, isLoading, mustSetPassword } = useAuth();
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

        <LoginForm onSuccess={() => navigate('/dashboard')} />

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
