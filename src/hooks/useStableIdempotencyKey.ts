import { useRef } from 'react';

/**
 * Returns a stable idempotency key derived from (memberId, intent, draftId).
 *
 * Critical for billing/payment mutations: retries must reuse the SAME key so
 * the backend `record_payment` / `purchase_*` RPCs can dedupe accidental
 * double-submits (timeout, network blip, double-click).
 *
 * Re-renders with the same inputs return the same key.
 * Changing any input mints a fresh key.
 */
export function useStableIdempotencyKey(
  memberId: string | null | undefined,
  intent: string,
  draftId?: string | null,
): string {
  const cacheRef = useRef<{ signature: string; key: string } | null>(null);
  const draft = draftId ?? `draft-${memberId ?? 'anon'}`;
  const signature = `${memberId ?? 'anon'}|${intent}|${draft}`;

  if (cacheRef.current?.signature !== signature) {
    cacheRef.current = {
      signature,
      key: `${intent}:${memberId ?? 'anon'}:${draft}`,
    };
  }
  return cacheRef.current.key;
}
