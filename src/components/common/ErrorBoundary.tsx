import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportError } from '@/lib/errorReporter';
import { supabase } from '@/integrations/supabase/client';

const PUBLIC_PATH_PREFIXES = ['/', '/auth', '/privacy-policy', '/terms', '/data-deletion', '/embed', '/register', '/contract-sign', '/scan-login', '/howbody-login', '/reports', '/setup', '/unauthorized'];

function isLikelyAuthExpiredError(err: Error | null): boolean {
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('jwt') || msg.includes('expired') || msg.includes('not authenticated') || msg.includes('refresh') || msg.includes('auth session');
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);

    // Route to the unified log_error_event RPC (fingerprint dedup, single source).
    reportError(error.message || 'Unknown error', {
      severity: 'critical',
      stack: error.stack || null,
      context: {
        componentStack: errorInfo.componentStack,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      },
    }).catch(() => {
      // Never cause a secondary crash
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleHome = async () => {
    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    const isPublic = PUBLIC_PATH_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));

    // If error looks like an auth/session issue, sign out cleanly and go to /auth
    if (isLikelyAuthExpiredError(this.state.error)) {
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      window.location.href = '/auth';
      return;
    }

    // Check active session to decide where "Home" goes
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        window.location.href = '/home';
        return;
      }
    } catch { /* ignore */ }

    window.location.href = isPublic ? '/' : '/auth';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const sessionLikelyExpired = isLikelyAuthExpiredError(this.state.error);
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {sessionLikelyExpired ? 'Your session expired' : 'Something went wrong'}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              {sessionLikelyExpired
                ? 'For your security, you were signed out after inactivity. Please sign in again to continue.'
                : 'We hit an unexpected error. You can retry, or head back to your dashboard.'}
            </p>
            <div className="flex gap-3 justify-center">
              {!sessionLikelyExpired && (
                <Button variant="outline" onClick={this.handleReset} className="gap-2">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Try Again
                </Button>
              )}
              <Button onClick={this.handleHome} className="gap-2">
                <Home className="h-4 w-4" aria-hidden="true" />
                {sessionLikelyExpired ? 'Sign in' : 'Take me home'}
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
