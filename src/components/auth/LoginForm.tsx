import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Mail, Phone, ArrowLeft, Loader2 } from 'lucide-react';
import { OtpLoginForm } from './OtpLoginForm';
import { PhoneOtpLoginForm } from './PhoneOtpLoginForm';

const passwordLoginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password is required'),
});

type PasswordLoginData = z.infer<typeof passwordLoginSchema>;
type LoginMode = 'password' | 'email_otp' | 'phone_otp';

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>('password');
  const { toast } = useToast();

  const form = useForm<PasswordLoginData>({
    resolver: zodResolver(passwordLoginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: PasswordLoginData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) throw error;
      toast({ title: 'Welcome back!', description: 'Successfully logged in.' });
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Login Failed',
        description: error instanceof Error ? error.message : 'Invalid credentials',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loginMode === 'email_otp') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setLoginMode('password')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to password login
        </button>
        <OtpLoginForm />
      </div>
    );
  }

  if (loginMode === 'phone_otp') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setLoginMode('password')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to password login
        </button>
        <PhoneOtpLoginForm />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground font-medium">Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    className="h-11 bg-secondary/50 border-border focus:border-accent"
                    {...field}
                  />
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
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="h-11 bg-secondary/50 border-border focus:border-accent pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
            className="w-full h-11 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base shadow-lg shadow-accent/20"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </Form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or continue with</span>
        </div>
      </div>

      {/* Alternate login methods */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setLoginMode('email_otp')}
          className="h-11 border-border hover:border-accent/50 hover:bg-accent/5 transition-all"
        >
          <Mail className="mr-2 h-4 w-4 text-accent" />
          Email OTP
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setLoginMode('phone_otp')}
          className="h-11 border-border hover:border-accent/50 hover:bg-accent/5 transition-all"
        >
          <Phone className="mr-2 h-4 w-4 text-accent" />
          Phone OTP
        </Button>
      </div>
    </div>
  );
}
