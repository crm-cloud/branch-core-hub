/**
 * Deterministic cart hash for stable idempotency keys.
 *
 * Same cart contents (regardless of insertion order), promo, and wallet flag
 * → same hash → same idempotency key on retry. Any change mints a new key.
 */
export function hashCart(input: {
  items: Array<{ id: string; quantity: number; unitPrice: number }>;
  promoCode?: string | null;
  walletApplied?: number;
}): string {
  const items = [...input.items]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((i) => `${i.id}:${i.quantity}:${i.unitPrice}`)
    .join('|');
  const promo = (input.promoCode || '').toUpperCase();
  const wallet = Math.round((input.walletApplied || 0) * 100);
  const raw = `${items}::${promo}::${wallet}`;
  // djb2-style hash
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
