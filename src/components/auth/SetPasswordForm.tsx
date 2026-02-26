import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Lock, Eye, EyeOff, Check } from 'lucide-react';
import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export function SetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setPassword: updatePassword, profile } = useAuth();
  const navigate = useNavigate();

  const passwordValidation = passwordSchema.safeParse(password);
  const passwordRequirements = [
    { met: password.length >= 8, text: 'At least 8 characters' },
    { met: /[A-Z]/.test(password), text: 'One uppercase letter' },
    { met: /[a-z]/.test(password), text: 'One lowercase letter' },
    { met: /[0-9]/.test(password), text: 'One number' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordValidation.success) {
      toast.error(passwordValidation.error.errors[0].message);
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    const { error } = await updatePassword(password);
    setIsLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Password set successfully!');
    navigate('/home');
  };

  return (
    <Card className="w-full max-w-md glass animate-in">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Lock className="h-7 w-7" />
        </div>
        <CardTitle className="text-2xl font-bold">Welcome!</CardTitle>
        <CardDescription>
          Hi{profile?.full_name ? `, ${profile.full_name}` : ''}! Please set your password to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="new-password"
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-sm font-medium text-foreground mb-2">Password requirements:</p>
            <ul className="space-y-1">
              {passwordRequirements.map((req, i) => (
                <li
                  key={i}
                  className={`flex items-center gap-2 text-sm ${
                    req.met ? 'text-success' : 'text-muted-foreground'
                  }`}
                >
                  <Check className={`h-3 w-3 ${req.met ? 'opacity-100' : 'opacity-30'}`} />
                  {req.text}
                </li>
              ))}
            </ul>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !passwordValidation.success || password !== confirmPassword}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting password...
              </>
            ) : (
              'Set Password & Continue'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}