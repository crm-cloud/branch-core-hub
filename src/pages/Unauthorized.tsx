import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldX, ArrowLeft, Lock, Fingerprint } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/40 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-destructive/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-destructive/20 rounded-full animate-ping" />
        <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-primary/20 rounded-full animate-ping" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/3 left-1/2 w-1 h-1 bg-warning/30 rounded-full animate-ping" style={{ animationDelay: '2s' }} />
      </div>

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-lg">
        <div className="bg-card/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-destructive/5 border border-border/50 p-10 text-center space-y-8">
          {/* Animated Icon */}
          <div className="relative mx-auto w-28 h-28">
            <div className="absolute inset-0 bg-destructive/10 rounded-full animate-[ping_3s_ease-in-out_infinite]" />
            <div className="absolute inset-2 bg-destructive/5 rounded-full" />
            <div className="relative flex h-full w-full items-center justify-center">
              <div className="absolute inset-0 border-2 border-dashed border-destructive/20 rounded-full animate-[spin_20s_linear_infinite]" />
              <ShieldX className="h-14 w-14 text-destructive drop-shadow-lg" />
            </div>
          </div>

          {/* Error Code */}
          <div className="space-y-1">
            <span className="inline-block px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-bold tracking-widest uppercase">
              Error 403
            </span>
          </div>

          {/* Title & Description */}
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Access Denied
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-sm mx-auto">
              You don't have the required permissions to view this page. This area is restricted to authorized personnel only.
            </p>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-foreground">Role-Based</p>
                <p className="text-[10px] text-muted-foreground">Access control</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                <Fingerprint className="h-4 w-4 text-warning" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-foreground">Secured</p>
                <p className="text-[10px] text-muted-foreground">Protected route</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link to="/dashboard" className="flex-1">
              <Button className="w-full gap-2 h-11 rounded-xl" size="lg">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-xl"
              size="lg"
              onClick={() => window.history.back()}
            >
              Go Back
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            If you believe this is an error, please contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
