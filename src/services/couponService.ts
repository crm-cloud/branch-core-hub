import { supabase } from '@/integrations/supabase/client';

export type CouponValidation = {
  success: true;
  code_id: string;
  code: string;
  discount_type: 'percentage' | 'fixed' | string;
  discount_value: number;
  discount_amount: number;
  remaining_uses: number | null;
} | {
  success: false;
  reason: string;
  code_id?: string;
  min_purchase?: number;
};

export type CouponRedemption = {
  success: true;
  redemption_id: string;
  code_id: string;
  code: string;
  discount_type: string;
  discount_amount: number;
  remaining_uses: number | null;
  replayed?: boolean;
} | {
  success: false;
  reason: string;
  code_id?: string;
};

const reasonLabels: Record<string, string> = {
  not_found: 'Invalid coupon code',
  inactive: 'This coupon is no longer active',
  not_started: 'This coupon is not yet valid',
  expired: 'This coupon has expired',
  max_uses: 'This coupon has reached its usage limit',
  min_purchase: 'Cart is below the minimum purchase amount',
  wrong_branch: 'This coupon is not valid at this branch',
};

export function couponReasonLabel(reason: string): string {
  return reasonLabels[reason] || reason;
}

/** Read-only: validate + preview discount without incrementing usage. */
export async function validateCoupon(params: {
  code: string;
  branchId: string | null;
  subtotal: number;
}): Promise<CouponValidation> {
  const { data, error } = await supabase.rpc('validate_coupon', {
    p_code: params.code,
    p_branch_id: params.branchId,
    p_subtotal: params.subtotal,
  });
  if (error) throw error;
  return data as CouponValidation;
}

/** Atomic: locks code, validates, increments times_used, records redemption. */
export async function redeemCoupon(params: {
  code: string;
  branchId: string | null;
  memberId?: string | null;
  subtotal: number;
  referenceType?: 'invoice' | 'sale' | 'order';
  referenceId?: string | null;
  idempotencyKey?: string | null;
}): Promise<CouponRedemption> {
  const { data, error } = await supabase.rpc('redeem_coupon', {
    p_code: params.code,
    p_branch_id: params.branchId,
    p_member_id: params.memberId ?? null,
    p_subtotal: params.subtotal,
    p_reference_type: params.referenceType ?? null,
    p_reference_id: params.referenceId ?? null,
    p_idempotency_key: params.idempotencyKey ?? null,
  });
  if (error) throw error;
  return data as CouponRedemption;
}
