## Findings

The reported errors map to real issues in the current production flow:

1. `create-payment-order` fails because it only checks branch-specific payment settings. The project has an active global Razorpay gateway, so member invoice payments incorrectly return “Payment gateway not configured”.
2. `/my-invoices` still uses the older direct Razorpay order flow and generic error handling, while store and membership flows use payment links. This needs one unified checkout handoff.
3. `create_pos_sale` fails because the deployed RPC still casts invoice `source` to a non-existent `invoice_source` enum. The `invoices.source` column is plain text.
4. The member-store flow currently opens a gateway URL in a new tab/redirect. The requested behavior is a checkout page with embedded/provider checkout where supported.
5. The `profiles` 406 is caused by `.single()` on profile lookups where the API cannot coerce the response into one JSON object. These should use `.maybeSingle()` with safe fallback.
6. `THREE.Color: Unknown color transparent` is caused by `gl.setClearColor('transparent')`. Three.js needs a real color plus alpha.
7. `avatar-female.glb` 404 occurs because the app probes `/models/avatar-female.glb` but the file is not present. It should avoid missing-asset network noise and fall back cleanly.
8. “No Active Diet Plan” and “No exercises found for Chest” are not crashes, but the workout issue is caused by an empty `exercises` table. The member UX should not log this as a system error.
9. System Health has recorded these as open errors; after fixes, related known-noise entries should be marked resolved/cleaned up.

## Implementation Plan

### Phase 1 — Stop current backend errors

- Patch the `create_pos_sale` RPC with a migration:
  - remove `'pos'::invoice_source` and write `source = 'pos'` as text
  - keep wallet, coupon, inventory, invoice, and idempotency behavior intact
  - add safer idempotency behavior so retrying the same store checkout cannot create duplicate POS rows/invoices
- Harden `create-payment-order` backend function:
  - lookup active gateway by branch first, then global fallback
  - return structured codes such as `NO_GATEWAY`, `INVOICE_PAID`, `INVALID_GATEWAY`, `GATEWAY_ERROR`
  - record canonical `payment_transactions` with `source = 'order'`
  - include enough client data for embedded checkout: Razorpay key/order ID, PhonePe token URL/redirect URL where configured
- Keep `create-razorpay-link` for invoice sharing/manual link workflows, but stop using it as the default member checkout path.

### Phase 2 — Unified member checkout page with embedded/provider flow

- Convert `/member/pay?invoice=...` into the single member payment page used by:
  - My Invoices
  - Member Store checkout
  - Membership purchase pending invoices
  - Benefit/add-on invoice flows where applicable
- Update Member Store so when payment is due it creates the pending invoice, then navigates to:
  - `/member/pay?invoice=<invoiceId>`
  instead of opening a new tab or redirecting to a payment link.
- Update My Invoices “Pay” action to navigate/open the checkout page rather than invoking the old direct payment flow inside a drawer.
- Implement provider-specific embedded behavior:
  - Razorpay: use `checkout.js` Standard Checkout modal. This is Razorpay’s same-page embedded overlay, not a full-page redirect.
  - PhonePe: use PhonePe Checkout script with `PhonePeCheckout.transact({ tokenUrl, type: 'IFRAME' })` when the gateway is PhonePe.
  - PayU and CCAvenue: keep as prepared provider slots but do not fake iframe behavior unless credentials/API requirements are confirmed; return a clear “provider not yet supported for embedded checkout” message rather than silently redirecting.
- Add realtime invoice status updates on the checkout page so members see paid/partial status as soon as webhooks settle the invoice.

### Phase 3 — Payment verification and webhook authority

- Add/restore a `verify-payment` backend function for Razorpay handler verification from the checkout modal:
  - verify signature server-side
  - find the canonical `payment_transactions` row by gateway order ID
  - call the authoritative `settle_payment` RPC with an idempotency key
  - return updated invoice status to the client
- Audit `payment-webhook` for order-based Razorpay payments so webhook retries also settle via `settle_payment` idempotently.
- Ensure payment completion always flows through backend authority, never direct client-side invoice/payment writes.

### Phase 4 — Fix frontend/system health noise

- Add `SheetDescription` to sheets missing descriptions or make the base `SheetContent` provide a hidden fallback description to eliminate the Radix warning.
- Replace `gl.setClearColor('transparent')` with a valid transparent clear color, for example `gl.setClearColor(0x000000, 0)`.
- Prevent `/models/avatar-female.glb` 404 by falling back to the procedural model unless a known model asset exists; avoid probing missing files in production.
- Change profile `.single()` lookups in workout/analytics/class booking code to `.maybeSingle()` with fallback labels.
- Handle empty workout exercise catalog gracefully:
  - `generateDailyWorkout` returns an empty workout instead of throwing for empty catalog
  - `/my-workout` shows a premium empty state and “request trainer plan” CTA without logging a backend/system error
- Keep `/my-diet` UI/UX intact, but make “No Active Diet Plan” clearly an expected empty state, not an error.

### Phase 5 — System Health cleanup and QA

- Review the latest `error_logs` entries and mark resolved the entries directly fixed by this sprint:
  - `type invoice_source does not exist`
  - `Payment gateway not configured` from global gateway fallback
  - `Cannot coerce the result to a single JSON object` profile errors
  - frontend payment errors caused by the failed function responses
- Keep unrelated older/network/auth errors open unless they are also fixed or clearly stale.
- Add targeted tests/checks:
  - backend function test/call for missing params, paid invoice, global Razorpay fallback
  - POS checkout RPC smoke test path where possible
  - frontend build/typecheck
  - manual end-to-end verification plan for member store -> invoice -> checkout -> gateway modal/iframe -> invoice status update

## Provider iframe/documentation decision

- Razorpay’s documented Standard Checkout uses `checkout.js` and opens a secure same-page checkout modal; this satisfies the “not redirect” requirement for Razorpay.
- PhonePe’s docs explicitly support IFrame mode via `PhonePeCheckout.transact({ tokenUrl, callback, type: 'IFRAME' })` using the Payment API response URL.
- PayU/CCAvenue iframe support is more account/API-specific and less reliable from public docs. I will not implement a fake iframe for them; I will structure the checkout adapter so they can be added once exact merchant docs/credentials are confirmed.

## Files likely to change

- `supabase/functions/create-payment-order/index.ts`
- `supabase/functions/verify-payment/index.ts` (new/restored)
- `supabase/functions/payment-webhook/index.ts`
- a new migration for `create_pos_sale` and optional idempotency cleanup
- `src/services/paymentService.ts`
- `src/pages/MemberCheckout.tsx`
- `src/pages/MyInvoices.tsx`
- `src/pages/MemberStore.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/progress3d/MemberBodyAvatarCanvas.tsx`
- `src/components/progress3d/AvatarGltf.tsx`
- `src/services/workoutShufflerService.ts`
- `src/pages/MyWorkout.tsx`
- profile lookup call sites using `.single()` where they cause 406s

After approval, I will implement these fixes in the order above and then run backend/function checks plus a frontend build/typecheck.