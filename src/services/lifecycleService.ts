import { supabase } from "@/integrations/supabase/client";

export type MemberLifecycleState =
  | "created"
  | "pending_verification"
  | "verified"
  | "active"
  | "suspended"
  | "archived";

/**
 * Atomic, server-validated transition for a member's lifecycle state.
 * Writes to `member_lifecycle_transitions` audit trail in the same txn.
 */
export async function transitionMemberLifecycle(
  memberId: string,
  toState: MemberLifecycleState,
  reason?: string,
): Promise<{ from_state: string | null; to_state: string }> {
  const { data, error } = await supabase.rpc("transition_member_lifecycle", {
    p_member_id: memberId,
    p_to_state: toState,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return data as { from_state: string | null; to_state: string };
}
