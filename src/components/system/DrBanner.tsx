import { AlertTriangle } from "lucide-react";
import { useDrMode } from "@/hooks/useDrMode";

/**
 * Sticky top banner shown when:
 *  - the frontend is the DR mirror (VITE_APP_ENV=dr), or
 *  - the database dr_mode flag is enabled.
 *
 * Server-side, the dr_block_writes trigger blocks mutations on
 * critical tables; this banner is the user-visible counterpart.
 */
export function DrBanner() {
  const { isReadOnly, hostIsDr, reason } = useDrMode();
  if (!isReadOnly) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex w-full items-center justify-center gap-2 bg-destructive px-4 py-2 text-destructive-foreground shadow-md"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <p className="text-xs font-medium sm:text-sm">
        {hostIsDr
          ? "Disaster-recovery environment — read-only. Use the primary site for changes."
          : "Disaster-recovery mode is active — writes are temporarily disabled."}
        {reason ? <span className="ml-2 opacity-90">({reason})</span> : null}
      </p>
    </div>
  );
}
