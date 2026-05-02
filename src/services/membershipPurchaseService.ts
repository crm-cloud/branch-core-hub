import { supabase } from "@/integrations/supabase/client";

export interface MembershipPurchaseInput {
  memberId: string;
  planId: string;
  branchId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  price: number;
  discountAmount?: number;
  discountReason?: string;
  paymentMethod?: string;
  amountPaid?: number;
  notes?: string;
  /** Stable client-generated key — guarantees retries don't double-charge. */
  idempotencyKey: string;
}

export interface MembershipPurchaseResult {
  membership_id: string;
  invoice_id: string;
  payment: unknown | null;
}

/**
 * Server-side atomic purchase. Wraps:
 *   memberships → invoice → invoice_items → record_payment → pg_notify
 * in a single transaction. Idempotent on `idempotencyKey`.
 */
export async function purchaseMembership(
  input: MembershipPurchaseInput,
): Promise<MembershipPurchaseResult> {
  const { data, error } = await supabase.rpc("purchase_membership", {
    p_idempotency_key: input.idempotencyKey,
    p_member_id: input.memberId,
    p_plan_id: input.planId,
    p_branch_id: input.branchId,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_price: input.price,
    p_discount_amount: input.discountAmount ?? 0,
    p_discount_reason: input.discountReason ?? null,
    p_payment_method: input.paymentMethod ?? "cash",
    p_amount_paid: input.amountPaid ?? 0,
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
  return data as unknown as MembershipPurchaseResult;
}
