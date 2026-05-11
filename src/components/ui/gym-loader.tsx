import { cn } from '@/lib/utils';

interface GymLoaderProps {
  text?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Premium themed loader: pulsing primary halo + spinning arc + bouncing
 * dumbbell glyph. Uses semantic tokens only so it adapts to light/dark.
 */
export function GymLoader({ text = 'Loading...', className, size = 'md' }: GymLoaderProps) {
  const dims = {
    sm: { ring: 56, dumb: 22 },
    md: { ring: 84, dumb: 32 },
    lg: { ring: 112, dumb: 44 },
  }[size];

  return (
    <div className={cn('flex flex-col items-center gap-5', className)}>
      <div className="relative" style={{ width: dims.ring, height: dims.ring }}>
        {/* Soft glow */}
        <div className="absolute inset-0 rounded-full bg-primary/15 blur-2xl animate-pulse" />

        {/* Faint full ring */}
        <div className="absolute inset-0 rounded-full border-2 border-primary/15" />

        {/* Spinning arc */}
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-primary/60 animate-spin" />

        {/* Center dumbbell */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            width={dims.dumb}
            height={dims.dumb * 0.45}
            viewBox="0 0 72 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="animate-dumbbell-bounce"
          >
            <rect x="4" y="6" width="8" height="20" rx="2" className="fill-primary" />
            <rect x="12" y="10" width="5" height="12" rx="1" className="fill-primary/70" />
            <rect x="17" y="13" width="38" height="6" rx="3" className="fill-foreground/40" />
            <rect x="55" y="10" width="5" height="12" rx="1" className="fill-primary/70" />
            <rect x="60" y="6" width="8" height="20" rx="2" className="fill-primary" />
          </svg>
        </div>
      </div>

      {text && (
        <p className="text-sm font-medium tracking-wide text-foreground/70 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}
