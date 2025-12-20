import { ResetPasswordRequestForm } from '@/components/auth/ResetPasswordRequestForm';

export default function ForgotPasswordPage() {
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
        </div>

        <ResetPasswordRequestForm />
      </div>
    </div>
  );
}