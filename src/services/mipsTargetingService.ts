import { supabase } from "@/integrations/supabase/client";

export interface MipsTargetResolutionInput {
  branchId: string;
  deviceIds?: string[];
}

export interface ResolvedMipsTarget {
  device_id: string;
  branch_id: string;
  ip_address: string | null;
  device_name: string | null;
}

/**
 * Mandatory branch-bound resolver for any MIPS dispatch.
 * Throws synchronously if branchId is missing — fails closed.
 */
export async function resolveMipsTargets(
  input: MipsTargetResolutionInput,
): Promise<ResolvedMipsTarget[]> {
  if (!input.branchId) {
    throw new Error(
      "resolveMipsTargets: branchId is required (branch-bound dispatch only)",
    );
  }

  const baseQuery = supabase
    .from("access_devices")
    .select("id, branch_id, ip_address, device_name")
    .eq("branch_id", input.branchId);

  const { data, error } = input.deviceIds?.length
    ? await baseQuery.in("id", input.deviceIds)
    : await baseQuery;
  if (error) throw error;

  return (data ?? []).map((d) => ({
    device_id: d.id,
    branch_id: d.branch_id,
    ip_address: d.ip_address ? String(d.ip_address) : null,
    device_name: d.device_name,
  }));
}
