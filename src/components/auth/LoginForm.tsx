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
import { Eye, EyeOff, Loader2, Mail, Lock, RefreshCw, CheckCircle2 } from 'lucide-react';
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

  const form = useForm<PasswordLoginData>({
    resolver: zodResolver(passwordLoginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

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

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    if (next === 'email_code') {
      setOtpStep('send');
      setOtpEmail('');
      setOtp('');
      setOtpEmailError('');
    } else {
      setOtp('');
      setCountdown(0);
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
  };

  return (
    <div className="space-y-5">
      {/* Mode toggle — persists across both modes so user always sees both options */}
      <div className="flex rounded-xl bg-muted/60 p-1 gap-1">
        <button
          type="button"
          data-testid="tab-password"
          onClick={() => switchMode('password')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
            mode === 'password'
              ? 'bg-card shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Password
        </button>
        <button
          type="button"
          data-testid="tab-email-code"
          onClick={() => switchMode('email_code')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
            mode === 'email_code'
              ? 'bg-card shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Email code
        </button>
      </div>

      {/* ── PASSWORD MODE ── */}
      {mode === 'password' && (
        <div className="space-y-4">
          <div className="space-y-0.5">
            <h2 className="text-xl font-bold text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handlePasswordSubmit)} className="space-y-3.5">
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
        </div>
      )}

      {/* ── EMAIL CODE MODE ── */}
      {mode === 'email_code' && (
        <div className="space-y-4">
          {otpStep === 'send' ? (
            <>
              <div className="space-y-0.5">
                <h2 className="text-xl font-bold text-foreground">Sign in with a code</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your email and we'll send a 6-digit sign-in code.
                </p>
              </div>

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
            </>
          ) : (
            <>
              <div className="space-y-0.5">
                <h2 className="text-xl font-bold text-foreground">Enter the code</h2>
                <p className="text-sm text-muted-foreground">
                  A 6-digit code was sent to{' '}
                  <button
                    type="button"
                    onClick={() => { setOtpStep('send'); setOtp(''); }}
                    data-testid="btn-change-email"
                    className="font-semibold text-foreground underline-offset-2 hover:underline"
                  >
                    {otpEmail}
                  </button>
                  . Check your inbox and spam folder.
                </p>
              </div>

              {/* OTP slots — sized to fit 320px screens (w-9 at min, w-10 at sm+) */}
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  disabled={isLoading}
                  onComplete={handleVerifyOtp}
                  autoFocus
                  data-testid="input-otp-code"
                >
                  <InputOTPGroup className="gap-1.5 sm:gap-2">
                    <InputOTPSlot index={0} className="h-12 w-9 sm:w-10 text-lg rounded-xl border-border" />
                    <InputOTPSlot index={1} className="h-12 w-9 sm:w-10 text-lg rounded-xl border-border" />
                    <InputOTPSlot index={2} className="h-12 w-9 sm:w-10 text-lg rounded-xl border-border" />
                    <InputOTPSlot index={3} className="h-12 w-9 sm:w-10 text-lg rounded-xl border-border" />
                    <InputOTPSlot index={4} className="h-12 w-9 sm:w-10 text-lg rounded-xl border-border" />
                    <InputOTPSlot index={5} className="h-12 w-9 sm:w-10 text-lg rounded-xl border-border" />
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
