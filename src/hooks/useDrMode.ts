import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isDrHost } from "@/lib/runtime/host";
import { toast } from "sonner";

interface DrModeRow {
  enabled: boolean;
  reason: string | null;
  set_at: string | null;
  set_by: string | null;
}

async function fetchDrMode(): Promise<DrModeRow> {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .is("branch_id", null)
    .eq("key", "dr_mode")
    .maybeSingle();
  if (error) throw error;
  const v = (data?.value ?? {}) as Partial<DrModeRow>;
  return {
    enabled: Boolean(v.enabled),
    reason: v.reason ?? null,
    set_at: v.set_at ?? null,
    set_by: v.set_by ?? null,
  };
}

/**
 * Read DR mode flag from public.settings.
 * Combines the database flag (server enforces it via dr_block_writes trigger)
 * with the build-time host flag (VITE_APP_ENV=dr).
 */
export function useDrMode() {
  const { data, isLoading } = useQuery({
    queryKey: ["dr-mode"],
    queryFn: fetchDrMode,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const dbReadOnly = data?.enabled ?? false;
  const hostIsDr = isDrHost();
  const isReadOnly = dbReadOnly || hostIsDr;

  function assertWritable(actionLabel = "save changes"): boolean {
    if (!isReadOnly) return true;
    toast.error(
      hostIsDr
        ? `You're on the disaster-recovery environment. Cannot ${actionLabel} here.`
        : `Disaster-recovery mode is active. Cannot ${actionLabel} right now.`,
    );
    return false;
  }

  return {
    isLoading,
    isReadOnly,
    dbReadOnly,
    hostIsDr,
    reason: data?.reason ?? null,
    setAt: data?.set_at ?? null,
    assertWritable,
  };
}
