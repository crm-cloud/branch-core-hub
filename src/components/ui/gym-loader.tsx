import { cn } from '@/lib/utils';

interface GymLoaderProps {
  text?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function GymLoader({ text = 'Loading...', className, size = 'md' }: GymLoaderProps) {
  const sizeMap = { sm: 48, md: 72, lg: 96 };
  const w = sizeMap[size];
  const h = w * 0.45;

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <svg
        width={w}
        height={h}
        viewBox="0 0 72 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="animate-dumbbell-bounce"
      >
        {/* Left weight plate outer */}
        <rect x="4" y="4" width="8" height="24" rx="2" className="fill-accent" />
        {/* Left weight plate inner */}
        <rect x="12" y="8" width="5" height="16" rx="1" className="fill-accent/70" />
        {/* Bar */}
        <rect x="17" y="13" width="38" height="6" rx="3" className="fill-muted-foreground/50" />
        {/* Right weight plate inner */}
        <rect x="55" y="8" width="5" height="16" rx="1" className="fill-accent/70" />
        {/* Right weight plate outer */}
        <rect x="60" y="4" width="8" height="24" rx="2" className="fill-accent" />
        {/* Grip texture lines */}
        <line x1="30" y1="14.5" x2="30" y2="17.5" className="stroke-muted-foreground/30" strokeWidth="0.8" />
        <line x1="33" y1="14.5" x2="33" y2="17.5" className="stroke-muted-foreground/30" strokeWidth="0.8" />
        <line x1="36" y1="14.5" x2="36" y2="17.5" className="stroke-muted-foreground/30" strokeWidth="0.8" />
        <line x1="39" y1="14.5" x2="39" y2="17.5" className="stroke-muted-foreground/30" strokeWidth="0.8" />
        <line x1="42" y1="14.5" x2="42" y2="17.5" className="stroke-muted-foreground/30" strokeWidth="0.8" />
      </svg>
      {text && (
        <p className="text-sm text-muted-foreground animate-pulse font-medium tracking-wide">
          {text}
        </p>
      )}
    </div>
  );
}
