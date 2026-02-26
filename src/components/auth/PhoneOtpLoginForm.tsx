import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { Phone, Loader2, ArrowLeft } from 'lucide-react';

export function PhoneOtpLoginForm() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'verify'>('phone');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fullPhone = phone.startsWith('+') ? phone : `+91${phone}`;

  const sendOtp = async () => {
    if (phone.length < 10) {
      toast({ title: 'Invalid phone', description: 'Enter a valid phone number', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
      if (error) throw error;
      setStep('verify');
      toast({ title: 'OTP Sent', description: `Verification code sent to ${fullPhone}` });
    } catch (error: any) {
      toast({
        title: 'Failed to send OTP',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: otp,
        type: 'sms',
      });
      if (error) throw error;
      toast({ title: 'Welcome!', description: 'Successfully signed in.' });
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Invalid OTP',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'verify') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setStep('phone'); setOtp(''); }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Change number
        </button>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code sent to <strong>{fullPhone}</strong>
        </p>
        <div className="flex justify-center">
          <InputOTP maxLength={6} value={otp} onChange={setOtp}>
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          onClick={verifyOtp}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
          disabled={isLoading || otp.length !== 6}
        >
          {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying...</> : 'Verify & Sign In'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <div className="flex gap-2">
          <div className="flex items-center justify-center px-3 bg-muted rounded-md border text-sm text-muted-foreground min-w-[52px]">
            +91
          </div>
          <Input
            id="phone"
            type="tel"
            placeholder="9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="bg-input border-border focus:border-accent"
          />
        </div>
      </div>
      <Button
        onClick={sendOtp}
        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
        disabled={isLoading || phone.length < 10}
      >
        {isLoading ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
        ) : (
          <><Phone className="h-4 w-4 mr-2" /> Send OTP</>
        )}
      </Button>
    </div>
  );
}
