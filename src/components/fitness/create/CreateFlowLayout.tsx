import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FlowStep = 'build' | 'preview' | 'assign';

interface Props {
  title: string;
  subtitle?: string;
  step: FlowStep;
  buildLabel?: string;
  onBack?: () => void;
  backTo?: string;
  actions?: ReactNode;
  children: ReactNode;
}

const STEP_ORDER: FlowStep[] = ['build', 'preview', 'assign'];

export function CreateFlowLayout({ title, subtitle, step, buildLabel = 'Build', onBack, backTo, actions, children }: Props) {
  const navigate = useNavigate();
  const currentIdx = STEP_ORDER.indexOf(step);

  const labels: Record<FlowStep, string> = {
    build: buildLabel,
    preview: 'Preview',
    assign: 'Assign',
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => (onBack ? onBack() : backTo ? navigate(backTo) : navigate(-1))}
              className="mt-1 h-8 w-8 shrink-0"
              aria-label="Back"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>

        {/* Step indicator */}
        <div className="rounded-xl border bg-card p-3">
          <ol className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
            {STEP_ORDER.map((s, idx) => {
              const isCurrent = idx === currentIdx;
              const isDone = idx < currentIdx;
              return (
                <li key={s} className="flex items-center gap-2 sm:gap-4 shrink-0">
                  <div
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
                      isCurrent && 'bg-primary text-primary-foreground',
                      isDone && 'bg-success/15 text-success',
                      !isCurrent && !isDone && 'bg-muted text-muted-foreground'
                    )}
                  >
                    <span
                      className={cn(
                        'h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold',
                        isCurrent && 'bg-primary-foreground/20',
                        isDone && 'bg-success/20',
                        !isCurrent && !isDone && 'bg-background'
                      )}
                    >
                      {isDone ? <Check className="h-3 w-3" /> : idx + 1}
                    </span>
                    <span>{labels[s]}</span>
                  </div>
                  {idx < STEP_ORDER.length - 1 && (
                    <span className="h-px w-6 sm:w-12 bg-border" aria-hidden />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {children}
      </div>
    </AppLayout>
  );
}
