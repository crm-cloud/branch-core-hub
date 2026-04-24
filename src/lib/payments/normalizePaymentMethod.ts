/**
 * Single source of truth for converting UI payment-method strings into the
 * `public.payment_method` Postgres enum value.
 *
 * Valid enum values: cash | card | bank_transfer | wallet | upi | cheque | other
 *
 * UI sometimes uses extra labels (online, razorpay_link, netbanking, neft …) —
 * we map them all here so downstream code never sends an invalid value to the
 * `record_payment` / `settle_payment` RPCs.
 */
export type PaymentMethodEnum =
  | 'cash'
  | 'card'
  | 'bank_transfer'
  | 'wallet'
  | 'upi'
  | 'cheque'
  | 'other';

const ENUM_VALUES: ReadonlySet<PaymentMethodEnum> = new Set([
  'cash',
  'card',
  'bank_transfer',
  'wallet',
  'upi',
  'cheque',
  'other',
]);

const ALIASES: Record<string, PaymentMethodEnum> = {
  // direct
  cash: 'cash',
  card: 'card',
  credit_card: 'card',
  debit_card: 'card',
  pos: 'card',
  upi: 'upi',
  gpay: 'upi',
  phonepe: 'upi',
  paytm: 'upi',
  bhim: 'upi',
  bank_transfer: 'bank_transfer',
  banktransfer: 'bank_transfer',
  bank: 'bank_transfer',
  neft: 'bank_transfer',
  rtgs: 'bank_transfer',
  imps: 'bank_transfer',
  netbanking: 'bank_transfer',
  net_banking: 'bank_transfer',
  wallet: 'wallet',
  member_wallet: 'wallet',
  cheque: 'cheque',
  check: 'cheque',
  // anything online / payment-link based collapses to `other` for ledger purposes
  online: 'other',
  razorpay: 'other',
  razorpay_link: 'other',
  payment_link: 'other',
  link: 'other',
  payu: 'other',
  ccavenue: 'other',
  stripe: 'other',
  other: 'other',
};

export function normalizePaymentMethod(value: string | null | undefined): PaymentMethodEnum {
  if (!value) return 'other';
  const key = String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (ENUM_VALUES.has(key as PaymentMethodEnum)) return key as PaymentMethodEnum;
  return ALIASES[key] ?? 'other';
}
