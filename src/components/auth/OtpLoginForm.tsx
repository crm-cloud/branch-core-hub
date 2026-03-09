import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');

type Step = 'email' | 'otp';

export function OtpLoginForm() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signInWithOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    const { error } = await signInWithOtp(email);
    setIsLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Check your email for the login code');
    setStep('otp');
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter the complete 6-digit code');
      return;
    }

    setIsLoading(true);
    const { error } = await verifyOtp(email, otp);
    setIsLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Welcome back!');
    navigate('/home');
  };

  if (step === 'otp') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code sent to <strong>{email}</strong>
        </p>
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={setOtp}
            disabled={isLoading}
            onComplete={handleVerifyOtp}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          onClick={handleVerifyOtp}
          className="w-full h-11 bg-accent hover:bg-accent/90 text-accent-foreground"
          disabled={isLoading || otp.length !== 6}
        >
          {isLoading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
          ) : (
            'Verify & Sign In'
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Didn't receive the code?{' '}
          <button
            type="button"
            onClick={() => handleSendOtp()}
            disabled={isLoading}
            className="text-accent hover:underline font-medium"
          >
            Resend
          </button>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSendOtp} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="otp-email" className="text-foreground font-medium">Email</Label>
        <Input
          id="otp-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          autoComplete="email"
          autoFocus
          className="h-11 bg-secondary/50 border-border focus:border-accent"
        />
      </div>
      <Button
        type="submit"
        className="w-full h-11 bg-accent hover:bg-accent/90 text-accent-foreground"
        disabled={isLoading}
      >
        {isLoading ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending code...</>
        ) : (
          'Send Login Code'
        )}
      </Button>
    </form>
  );
}
