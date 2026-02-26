import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GymLoader } from '@/components/ui/gym-loader';

export default function AuthPage() {
  const { user, isLoading, mustSetPassword, roles } = useAuth();
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Capture referral code from URL (?ref=CODE)
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      sessionStorage.setItem('referral_code', refCode);
    }
  }, [searchParams]);

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const { data, error } = await supabase.functions.invoke('check-setup', {
          signal: controller.signal as any,
        });
        clearTimeout(timeout);

        if (error) throw error;
        if (data?.needsSetup) {
          setNeedsSetup(true);
        }
      } catch (error) {
        console.error('Setup check failed:', error);
        // On timeout/error, assume setup is done -- show login form
      } finally {
        setCheckingSetup(false);
      }
    };

    checkSetup();
  }, []);

  if (isLoading || checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-hero)' }}>
        <GymLoader text="Warming up..." />
      </div>
    );
  }

  if (needsSetup) {
    return <Navigate to="/setup" replace />;
  }

  // All authenticated users go through Gatekeeper
  if (user && !mustSetPassword) {
    return <Navigate to="/home" replace />;
  }

  if (user && mustSetPassword) {
    return <Navigate to="/auth/set-password" replace />;
  }

  const handleLoginSuccess = () => {
    navigate('/home');
  };

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
