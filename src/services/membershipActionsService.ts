/**
 * P4 — Atomic membership lifecycle actions.
 *
 * All cancel / freeze flows go through these RPCs — never multi-step
 * client writes. Mirrors the `purchase_membership` pattern from P3.
 */
import { supabase } from '@/integrations/supabase/client';

export interface CancelMembershipInput {
  membershipId: string;
  reason: string;
  refundAmount?: number;
  refundMethod?: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'wallet';
  idempotencyKey?: string;
}

export interface CancelMembershipResult {
  membership_id: string;
  refund_invoice_id: string | null;
  refund_payment_id: string | null;
  refund_amount: number;
}

export async function cancelMembership(
  input: CancelMembershipInput,
): Promise<CancelMembershipResult> {
  const { data, error } = await supabase.rpc('cancel_membership', {
    p_membership_id: input.membershipId,
    p_reason: input.reason,
    p_refund_amount: input.refundAmount ?? 0,
    p_refund_method: input.refundMethod ?? 'cash',
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (error) throw error;
  return data as unknown as CancelMembershipResult;
}

export interface FreezeMembershipInput {
  membershipId: string;
  freezeDays: number;
  reason: string;
}

export async function freezeMembership(input: FreezeMembershipInput) {
  const { data, error } = await supabase.rpc('freeze_membership', {
    p_membership_id: input.membershipId,
    p_freeze_days: input.freezeDays,
    p_reason: input.reason,
  });
  if (error) throw error;
  return data;
}

/**
 * Set the user's active branch on the server. Pass `null` to clear (owners only).
 * Validates membership in branch + writes to `user_active_branch`.
 */
export async function setActiveBranch(branchId: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_active_branch', { p_branch_id: branchId });
  if (error) throw error;
}
