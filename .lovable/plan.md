## Goal

Replace fragmented add-on selling and client-side store billing with one backend-authoritative path per workflow, and surface real add-on purchase journeys for both staff and members.

---

## Phase 1 — Backend authority + idempotency (correctness)

### 1.1 Member Store checkout → `create_pos_sale`
Replace the multi-step client orchestration in `src/pages/MemberStore.tsx` (`checkout` mutation) with a single RPC call:

- Use existing `create_pos_sale(p_branch_id, p_member_id, p_items, p_payment_method, p_sold_by, p_discount_amount, p_discount_code_id, p_discount_code, p_wallet_applied, p_idempotency_key, ...)`.
- Stop client-side: direct `wallets`/`wallet_transactions` debit, `discount_codes.times_used` increment, manual `invoices` + `invoice_items` insert.
- Build `p_items` from cart `[{product_id, quantity, unit_price}]`.
- Resolve `discount_code_id` when applying promo so the RPC can row-lock and atomically increment usage (avoids the current race / partial-success window).
- Pass `p_wallet_applied = walletDeduction`; RPC owns the wallet debit + ledger row.
- Use a stable idempotency key: `useStableIdempotencyKey(member.id, 'member_store_checkout', cartHash)` where `cartHash` is a deterministic hash of sorted cart item ids+qty+promo+wallet flag, so retries reuse the key.

### 1.2 Reward redemption → `claim_referral_reward`
In `MemberStore.tsx`, replace the `claimReward` mutation (which currently flips `is_claimed` + credits wallet from the client) with:
```ts
supabase.rpc('claim_referral_reward', {
  p_reward_id: rewardId,
  p_member_id: member.id,
  p_idempotency_key: stableKey,
})
```
Atomic, retry-safe, already wired into the lifecycle audit.

### 1.3 Add-on idempotency stabilization
Audit any remaining call sites that still build keys with `Date.now()` for `purchase_benefit_credits` / `purchase_benefit_topup` / `purchase_pt_package`. Replace with `useStableIdempotencyKey(memberId, intent, draftId)` so a refresh/retry of the same drawer reuses the same key. (`TopUpBenefitDrawer` already does this — extend pattern to the new add-on drawer below.)

---

## Phase 2 — Real add-on sales UX

### 2.1 New unified add-on purchase drawer
Create `src/components/benefits/PurchaseAddOnDrawer.tsx` (right-side Sheet, per project standard):

- Tabs: **Benefit Credits**, **PT Packages** (and a placeholder for future service add-ons).
- Lists active packages from `benefit_packages` (grouped by `benefit_type` → Sauna / Steam / Spa / Recovery / Other) and `pt_packages` (grouped by `package_type`/`session_type`).
- Each card shows: name, sessions/credits, validity (days), price, GST note, "already owned: X credits remaining" badge if member has live credits of that type.
- Calls the right RPC on confirm:
  - Benefit credits → `purchase_benefit_credits(p_member_id, p_membership_id, p_package_id, p_branch_id, p_payment_method, p_idempotency_key)`
  - PT → `purchase_pt_package(_member_id, _package_id, _trainer_id, _branch_id, _price_paid, _payment_method, _idempotency_key)` (trainer picker required).
- Stable idempotency key: `(memberId, 'addon_purchase', `${packageId}:${draftId}`)`.

### 2.2 Discoverability wiring
- **`MyBenefits.tsx` (member self-service)**: Replace the empty-state CTA pointing to `/member-store` with a primary "Buy Add-On Credits" button that opens `PurchaseAddOnDrawer` (member mode, payment_method = `pending` or `online` flow). Show the same CTA above the credits grid, not only when empty. Remove the misleading product-store link for benefit add-ons.
- **`MemberProfileDrawer` benefits tab (staff)**: Add a "Sell Add-On" button next to each benefit row (and a top-level "Sell Add-On" button on the tab) that opens `PurchaseAddOnDrawer` in staff mode. Currently top-up only appears after exhaustion; this exposes proactive upsell for any benefit/PT.
- **`BenefitTracking.tsx`** (staff page): Add the same "Sell Add-On" CTA in the page header so staff can upsell from the operational view.

### 2.3 Storefront separation
Keep `/member-store` product-only. Add a clearly separated section header "Products" and a sibling banner card "Looking for extra sessions or PT? → Buy Add-Ons" that opens `PurchaseAddOnDrawer`. Do not mix benefit add-ons into the products grid (different fulfillment, different RPC).

---

## Phase 3 — Acceptance polish

- All add-on purchases land in `invoices` via the existing RPCs (already do; verify `source` tagging).
- Toasts/QueryClient invalidations: `member-benefit-credits`, `member-pt-packages`, `wallet`, `member-invoices`, `unclaimed-rewards`.
- RBAC: staff variant of drawer allows cash/card/UPI; member variant restricts to wallet/online.
- Loading/skeleton + error boundaries per project conventions.

---

## Files touched

**New**
- `src/components/benefits/PurchaseAddOnDrawer.tsx`
- (small) `src/lib/cartHash.ts` — deterministic cart hash helper

**Edited**
- `src/pages/MemberStore.tsx` — RPC-based checkout + reward claim + Add-Ons banner
- `src/pages/MyBenefits.tsx` — Add-On CTA, remove product-store dead-end
- `src/pages/BenefitTracking.tsx` — header Sell Add-On CTA
- `src/components/members/MemberProfileDrawer.tsx` (benefits tab) — Sell Add-On entry points

**No DB migration required** — all needed RPCs (`create_pos_sale`, `claim_referral_reward`, `purchase_benefit_credits`, `purchase_pt_package`, `purchase_benefit_topup`) already exist with idempotency support.

---

## Acceptance check

1. Member-store checkout makes exactly one server call (`create_pos_sale`); no direct client writes to `wallets`, `discount_codes`, `invoices`, `invoice_items`.
2. Refreshing during checkout and retrying does not double-charge wallet, double-use promo, or create duplicate invoices.
3. Reward redeem in store calls `claim_referral_reward` and is idempotent.
4. Members see a clear "Buy Add-On Credits" path from `MyBenefits` that does **not** dump them into the product store.
5. Staff can proactively sell benefit credits / PT packages from the member profile and benefit tracking pages, before exhaustion.
6. Add-on purchases appear in invoices and finance with correct GST and source tags.
