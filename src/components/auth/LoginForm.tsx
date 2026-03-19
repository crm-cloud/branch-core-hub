import { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, ArrowLeft, Mail, Lock, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const passwordLoginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const emailSchema = z.string().email('Enter a valid email address');

type PasswordLoginData = z.infer<typeof passwordLoginSchema>;
type Mode = 'password' | 'email_code';
type OtpStep = 'send' | 'verify';

const RESEND_COOLDOWN = 60;

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>('password');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast: shadToast } = useToast();

  const [otpStep, setOtpStep] = useState<OtpStep>('send');
  const [otpEmail, setOtpEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpEmailError, setOtpEmailError] = useState('');
  const [countdown, setCountdown] = useState(0);

  const navigate = useNavigate();
  const { signInWithOtp, verifyOtp } = useAuth();
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firstOtpSlotRef = useRef<HTMLInputElement>(null);

  const form = useForm<PasswordLoginData>({
    resolver: zodResolver(passwordLoginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    if (otpStep === 'verify' && firstOtpSlotRef.current) {
      setTimeout(() => firstOtpSlotRef.current?.focus(), 100);
    }
  }, [otpStep]);

  const startCountdown = () => {
    setCountdown(RESEND_COOLDOWN);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handlePasswordSubmit = async (data: PasswordLoginData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) throw error;
      shadToast({ title: 'Welcome back!', description: 'Successfully signed in.' });
      onSuccess?.();
    } catch (error) {
      shadToast({
        title: 'Sign in failed',
        description: error instanceof Error ? error.message : 'Invalid credentials',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCode = async () => {
    const validation = emailSchema.safeParse(otpEmail);
    if (!validation.success) {
      setOtpEmailError('Enter a valid email address');
      return;
    }
    setOtpEmailError('');
    setIsLoading(true);
    const { error } = await signInWithOtp(otpEmail);
    setIsLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Code sent! Check your inbox.');
    setOtpStep('verify');
    startCountdown();
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;
    setIsLoading(true);
    const { error } = await signInWithOtp(otpEmail);
    setIsLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('New code sent.');
    setOtp('');
    startCountdown();
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    setIsLoading(true);
    const { error } = await verifyOtp(otpEmail, otp);
    setIsLoading(false);
    if (error) {
      toast.error(error.message || 'Invalid code — please try again.');
      setOtp('');
      return;
    }
    toast.success('Welcome back!');
    navigate('/home');
  };

  const switchToEmailCode = () => {
    setMode('email_code');
    setOtpStep('send');
    setOtpEmail('');
    setOtp('');
    setOtpEmailError('');
    setCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const switchToPassword = () => {
    setMode('password');
    setOtpStep('send');
    setOtp('');
    setCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  if (mode === 'email_code') {
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={switchToPassword}
              data-testid="btn-back-to-password"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            >
              <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Back
            </button>
          </div>

          {otpStep === 'send' ? (
            <>
              <h2 className="text-xl font-bold text-foreground">Sign in with a code</h2>
              <p className="text-sm text-muted-foreground">
                Enter your email and we'll send a 6-digit sign-in code.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-foreground">Enter the code</h2>
              <p className="text-sm text-muted-foreground">
                A 6-digit code was sent to{' '}
                <button
                  type="button"
                  onClick={() => { setOtpStep('send'); setOtp(''); }}
                  className="font-semibold text-foreground underline-offset-2 hover:underline"
                >
                  {otpEmail}
                </button>
                . Check your inbox and spam folder.
              </p>
            </>
          )}
        </div>

        {otpStep === 'send' ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="otp-email" className="text-sm font-medium text-foreground">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="otp-email"
                  type="email"
                  placeholder="you@example.com"
                  value={otpEmail}
                  onChange={e => { setOtpEmail(e.target.value); setOtpEmailError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                  disabled={isLoading}
                  autoComplete="email"
                  autoFocus
                  data-testid="input-otp-email"
                  className={`h-12 pl-9 text-base bg-secondary/50 border-border focus:border-accent ${otpEmailError ? 'border-destructive' : ''}`}
                />
              </div>
              {otpEmailError && (
                <p className="text-xs text-destructive">{otpEmailError}</p>
              )}
            </div>
            <Button
              onClick={handleSendCode}
              disabled={isLoading || !otpEmail}
              data-testid="btn-send-code"
              className="w-full h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base shadow-lg shadow-accent/20"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending code...</>
              ) : (
                'Send code'
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
                disabled={isLoading}
                onComplete={handleVerifyOtp}
                data-testid="input-otp-code"
              >
                <InputOTPGroup className="gap-2">
                  <InputOTPSlot index={0} className="h-12 w-10 text-lg rounded-xl border-border" />
                  <InputOTPSlot index={1} className="h-12 w-10 text-lg rounded-xl border-border" />
                  <InputOTPSlot index={2} className="h-12 w-10 text-lg rounded-xl border-border" />
                  <InputOTPSlot index={3} className="h-12 w-10 text-lg rounded-xl border-border" />
                  <InputOTPSlot index={4} className="h-12 w-10 text-lg rounded-xl border-border" />
                  <InputOTPSlot index={5} className="h-12 w-10 text-lg rounded-xl border-border" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              onClick={handleVerifyOtp}
              disabled={isLoading || otp.length !== 6}
              data-testid="btn-verify-code"
              className="w-full h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base shadow-lg shadow-accent/20"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
              ) : (
                <><CheckCircle2 className="mr-2 h-4 w-4" /> Verify &amp; Sign In</>
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Didn't receive it?{' '}
              {countdown > 0 ? (
                <span className="text-muted-foreground/70">
                  Resend in <span className="tabular-nums font-medium">{countdown}s</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isLoading}
                  data-testid="btn-resend-code"
                  className="text-accent hover:underline font-medium inline-flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" /> Resend now
                </button>
              )}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">Welcome back</h2>
        <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handlePasswordSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground font-medium">Email</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      data-testid="input-email"
                      className="h-12 pl-9 text-base bg-secondary/50 border-border focus:border-accent"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground font-medium">Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      data-testid="input-password"
                      className="h-12 pl-9 pr-11 text-base bg-secondary/50 border-border focus:border-accent"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            data-testid="btn-sign-in"
            className="w-full h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base shadow-lg shadow-accent/20"
            disabled={isLoading}
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </Form>

      <div className="flex items-center justify-center">
        <Link
          to="/auth/forgot-password"
          data-testid="link-forgot-password"
          className="text-sm text-muted-foreground hover:text-accent transition-colors"
        >
          Forgot your password?
        </Link>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        data-testid="btn-email-code"
        onClick={switchToEmailCode}
        className="w-full h-12 border-border hover:border-accent/60 hover:bg-accent/5 transition-all text-base"
      >
        <Mail className="mr-2 h-4 w-4 text-accent" />
        Sign in without a password
      </Button>
    </div>
  );
}
