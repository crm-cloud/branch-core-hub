import type { ReactNode } from 'react';
import { Loader2, AlertTriangle, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DataStateProps {
  /** True while the data is being fetched for the first time. */
  isLoading?: boolean;
  /** Error returned by the query, or any truthy value to indicate an error. */
  error?: unknown;
  /** True when the request succeeded but returned no rows. */
  isEmpty?: boolean;
  /** Optional retry handler — shown only when error is truthy. */
  onRetry?: () => void;
  /** Empty-state copy. */
  emptyTitle?: string;
  emptyDescription?: string;
  /** Custom empty-state CTA. */
  emptyAction?: ReactNode;
  /** When all three states are false, render the children (success state). */
  children: ReactNode;
}

/**
 * Standardized empty / loading / error triplet for data-bound surfaces.
 * Renders a Vuexy-styled fallback card and falls through to children
 * when there is data to show.
 */
export function DataState({
  isLoading,
  error,
  isEmpty,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription = 'There’s no data to display.',
  emptyAction,
  children,
}: DataStateProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" aria-label="Loading" />
      </div>
    );
  }

  if (error) {
    const message =
      (error as { message?: string })?.message || 'Something went wrong while loading data.';
    return (
      <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 p-8 text-center">
        <div className="h-12 w-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">Couldn’t load this</h3>
        <p className="text-sm text-slate-500 mb-4">{message}</p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm">
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 p-8 text-center">
        <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
          <Inbox className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">{emptyTitle}</h3>
        <p className="text-sm text-slate-500 mb-4">{emptyDescription}</p>
        {emptyAction}
      </div>
    );
  }

  return <>{children}</>;
}
