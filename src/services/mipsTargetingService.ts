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

  let query = supabase
    .from("access_devices")
    .select("id, branch_id, ip_address, device_name, is_active")
    .eq("branch_id", input.branchId)
    .eq("is_active", true);

  if (input.deviceIds?.length) {
    query = query.in("id", input.deviceIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((d) => ({
    device_id: d.id,
    branch_id: d.branch_id,
    ip_address: d.ip_address,
    device_name: d.device_name,
  }));
}
