import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

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

    // Fire-and-forget: log to error_logs table
    this.logErrorToDatabase(error, errorInfo).catch(() => {
      // Silently ignore - never cause a secondary crash
    });
  }

  private async logErrorToDatabase(error: Error, errorInfo: ErrorInfo) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await (supabase.from('error_logs') as any).insert({
        user_id: user?.id || null,
        error_message: error.message || 'Unknown error',
        stack_trace: error.stack || null,
        component_name: errorInfo.componentStack || null,
        route: window.location.pathname,
        browser_info: navigator.userAgent,
        status: 'open',
      });
    } catch {
      // Silently fail
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Oops! Something went wrong</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Our team has been notified. Please try again or go back to the home page.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={this.handleReset} className="gap-2">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Try Again
              </Button>
              <Button onClick={() => window.location.href = '/'} className="gap-2">
                <Home className="h-4 w-4" aria-hidden="true" />
                Go Home
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
