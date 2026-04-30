import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { supabase } from '@/integrations/supabase/client';
import { GymLoader } from '@/components/ui/gym-loader';
import { Card, CardContent } from '@/components/ui/card';
import { getHomePath } from '@/lib/roleRedirect';

export default function AuthPage() {
  const { user, isLoading, mustSetPassword, roles } = useAuth();
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
        if (data?.needsSetup) setNeedsSetup(true);
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
        <GymLoader text="Warming up..." />
      </div>
    );
  }

  if (needsSetup) return <Navigate to="/setup" replace />;
  if (user && !mustSetPassword) return <Navigate to={getHomePath(roles)} replace />;
  if (user && mustSetPassword) return <Navigate to="/auth/set-password" replace />;

  const handleLoginSuccess = () => {
    navigate('/home');
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'var(--gradient-hero)' }}
    >
      <div className="w-full max-w-[420px] space-y-6">
        {/* Logo */}
        <div className="text-center space-y-1">
          <h1 className="text-5xl font-extrabold tracking-tight">
            <span className="text-gradient">Incline</span>
          </h1>
          <p className="text-primary-foreground/60 text-sm">Gym Management System</p>
        </div>

        {/* Login Card — self-contained with all auth modes */}
        <Card className="rounded-2xl border-0 shadow-2xl shadow-black/20 bg-card">
          <CardContent className="p-5 sm:p-7">
            <LoginForm onSuccess={handleLoginSuccess} />
          </CardContent>
        </Card>

        {/* Branding + legal footer */}
        <div className="text-center space-y-2">
          <p className="text-xs text-primary-foreground/30">Powered by Incline</p>
          <nav className="flex items-center justify-center gap-3 text-xs text-primary-foreground/50">
            <Link to="/privacy-policy" className="hover:text-primary-foreground/80 transition-colors">
              Privacy Policy
            </Link>
            <span aria-hidden className="text-primary-foreground/20">·</span>
            <Link to="/terms" className="hover:text-primary-foreground/80 transition-colors">
              Terms of Service
            </Link>
            <span aria-hidden className="text-primary-foreground/20">·</span>
            <Link to="/data-deletion" className="hover:text-primary-foreground/80 transition-colors">
              Data Deletion
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
