import * as React from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative rounded-3xl bg-white/[0.06] backdrop-blur-2xl ring-1 ring-inset ring-white/15 shadow-[0_25px_80px_-20px_rgba(0,0,0,0.6)]",
        "before:absolute before:inset-0 before:rounded-3xl before:bg-gradient-to-b before:from-white/10 before:to-transparent before:pointer-events-none",
        className
      )}
      {...props}
    >
      <div className="relative">{children}</div>
    </div>
  )
);
GlassCard.displayName = "GlassCard";
