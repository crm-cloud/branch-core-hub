## Deep Audit Findings

### Critical (data integrity / security)
1. **Benefit add-on flow is NOT atomic.** `purchase_benefit_credits` (RPC) creates the invoice → calls `settle_payment` → THEN inserts `member_benefit_credits`. If credit insert fails, member is billed with no credits. Needs all-or-nothing wrapper inside one transaction with explicit rollback on credit insert failure (or reorder so credits + invoice + payment commit together, and never leave a paid invoice without credits).
2. **Coupon redemption is client-validated only.** `POS.tsx` and `MemberStore.tsx` read `discount_codes`, compute discount client-side, then pass `discount_code_id` to `record_sale`/`settle_payment`. There is no server RPC that validates active/expiry/min purchase/max uses AND increments `times_used` atomically. Race condition allows over-redemption past `max_uses`.
3. **PersonnelSync uses public-URL fields.** `PersonnelSyncTab.tsx` reads `biometric_photo_url` (public-style) instead of the new `biometric_photo_path` + signed URL helper (`uploadBiometricPhoto` already exists and writes to private bucket `member-photos`). Photos may still be served via legacy public URLs.
4. **MIPS callback URL hard-coded.** `DeviceManagement.tsx` lines 140/143/160/163 hard-code `https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/mips-webhook-receiver` in the UI. Breaks when env/branch differs, and leaks the project ref in source.
5. **EquipmentMaintenance ignores branch on records & costs.** `fetchMaintenanceRecords()` and `getMaintenanceCostsByMonth(currentBranchId)` — the maintenance records query takes no branch filter; equipment list passes branch but maintenance + (often) stats do not consistently filter via the join.
6. **Referral claim paths are inconsistent.** `Referrals.tsx` and `MemberStore.tsx` partially bypass the service and call `supabase.rpc('claim_referral_reward', ...)` directly with their own argument shape; `MemberProfileDrawer.tsx` and `MemberReferrals.tsx` use `claimReward()` service. We need a single canonical path through `referralService.claimReward`.
7. **HRM payroll is a stub.** `compute_payroll` exists but only handles longest attendance, no shift table integration, no late/early thresholds, no half-day rule from settings, no overtime cap, no duplicate-active-row collapse beyond MIN/MAX, no holiday-pay multiplier, no leave-type pay rules.

### UX gaps (consistent with the request)
- Equipment: no branch badge, no "due/overdue maintenance" callout, no warranty-expiring strip, no QR per machine, no "create maintenance task" CTA.
- Devices: callbacks not env-aware, no last-heartbeat age, no failed-sync queue surface.
- Benefits: plan credits and add-on credits shown in separate places; no combined view, no expiry/low-balance warning, no "Sell add-on" CTA.
- Referrals: no lifecycle timeline (pending → eligible → issued → claimed → wallet credited).
- Discounts: no redemption history view, no failed-attempt log, no remaining-uses surfaced clearly.
- Classes: roster lacks quick attendance toggles, no-show reason capture, "waitlist promoted" badge, WhatsApp reminder action.

---

## Plan

### A. Database / RPC migration (single new migration)

1. **`record_benefit_addon_purchase` (replaces logic in `purchase_benefit_credits`)**
   - One BEGIN…END block: lock package, compute GST via `calc_gst`, insert invoice + items in `pending`, insert `member_benefit_credits` BEFORE `settle_payment`, then call `settle_payment`. If settle fails → RAISE → entire txn rolls back (no orphan credits, no orphan paid invoice). If credit insert fails → rollback before any payment.
   - Returns `{ success, credit_id, invoice_id, amount, gst }`.
   - Keep `purchase_benefit_credits` name as a thin wrapper for backward compatibility.

2. **`redeem_coupon(p_code, p_branch_id, p_member_id, p_subtotal, p_idempotency_key)`**
   - `SELECT … FOR UPDATE` on `discount_codes` row.
   - Validate: `is_active`, `valid_from <= now <= valid_until`, `times_used < max_uses`, `subtotal >= min_purchase`, branch match (or null).
   - Increment `times_used`.
   - Insert `discount_redemptions` row (new table) with `code_id, member_id, branch_id, order_ref, discount_amount, status='applied', created_at`.
   - Returns `{ success, discount_amount, code_id, redemption_id }` or `{ success: false, error }`.
   - Add `discount_redemption_attempts` table for failed attempts (audit + remaining uses display).
   - `record_sale` and `settle_payment` call this RPC instead of trusting client-passed discount.

3. **HRM payroll upgrade**
   - New tables/columns (only if missing): `staff_shifts (user_id, weekday, start_time, end_time, late_grace_min, half_day_threshold_hours, ot_threshold_hours, ot_multiplier)`, `holidays(holiday_date, branch_id, name, is_paid, multiplier)`.
   - Rewrite `compute_payroll`: per day, resolve shift; classify late (in > start + grace), early-out, missing checkout, half-day, OT (hours > shift + threshold capped by `ot_threshold`), holiday-pay multiplier, leave pay rule per `leave_type`. Collapse multiple attendance rows by summing intervals (cap at 24h).
   - Add `payroll_summarize(run_id)` returning per-employee payable_days, ot_hours, deductions.

4. **Coupon-related schema**
   - `discount_redemptions` and `discount_redemption_attempts` tables with RLS (admin/owner/manager all access; staff insert via RPC; member: own redemptions read).

### B. Frontend services & shared hooks

5. **`couponService.ts` (new)** — `validateAndPreviewCoupon(code, branchId, memberId, subtotal)` calls a read-only RPC that validates without incrementing (for live preview), and `redeemCoupon(...)` for the final commit. `POS.tsx` and `MemberStore.tsx` switch to this service. No client-side discount math is trusted on the server side; server returns the authoritative `discount_amount`.

6. **`referralService.ts` is the only path**
   - Update `Referrals.tsx` and `MemberStore.tsx` to import and use `claimReward` from the service.
   - Remove inline `supabase.rpc('claim_referral_reward', …)` calls.
   - Verify `MemberProfileDrawer.tsx` and `MemberReferrals.tsx` are already correct.

7. **`equipmentService.ts`** — accept `branchId` in `fetchMaintenanceRecords`, `getMaintenanceCostsByMonth`, `getEquipmentStats` (already partial). Filter via `equipment.branch_id` join. `EquipmentMaintenance.tsx` passes `currentBranchId` to all four queries and includes branch in query keys.

8. **PersonnelSync biometric** — `PersonnelSyncTab.tsx` reads `biometric_photo_path` (storage path). Use `resolveBiometricPhotoUrl` to get signed URLs for the avatar previews. Upload through `uploadBiometricPhoto` (already private). Migration: add `biometric_photo_path text` columns on `members`, `employees`, `trainers` if missing; backfill from any legacy public URL by parsing the path; deprecate writes to `biometric_photo_url`.

9. **MIPS callback URL** — Add `mips_webhook_receiver_url` to `integration_settings` (resolved per env). UI reads it from a tiny `useMipsCallbackUrls()` hook that falls back to `${VITE_SUPABASE_URL}/functions/v1/mips-webhook-receiver`. Remove all hard-coded `iyqqpbvnszyrrgerniog` strings from `DeviceManagement.tsx`.

### C. UI/UX work

10. **Equipment & EquipmentMaintenance**
    - Header: branch filter badge (active branch name + clear button).
    - KPI cards: add "Due this week", "Overdue maintenance", "Warranty expiring (30d)".
    - Row: QR code button (renders QR encoding `{branch}/{equipment_id}` for scan-to-log-maintenance flow) + "Create Maintenance Task" CTA that opens an existing TaskDrawer prefilled.

11. **DeviceManagement**
    - Replace hard-coded URL block with env-aware `<CopyableUrl label="Webhook URL" value={callbackUrl} />`.
    - Add per-device row: connection status pill, last heartbeat age (`formatDistanceToNow`), "Failed sync queue" tab listing rows from `mips_sync_log` where `status='failed'` with retry button.

12. **Benefits (`MyBenefits.tsx`, `MemberProfileDrawer` Benefits tab, BenefitTracking)**
    - Combined "Available credits" card: rows = plan-included credits + purchased add-on credits, with `expires_at`, type icon, low-balance pill (≤2 left), and a "Sell add-on" CTA (opens `PurchaseAddOnDrawer`).

13. **Referrals/rewards**
    - Lifecycle timeline component on each reward card: pending (referral created) → eligible (referee converted) → issued (reward generated) → claimed (member claimed) → wallet credited (wallet txn id). Uses `referrals.status` + `referral_rewards.status` + linked `wallet_transactions.id`.

14. **Discounts (`DiscountCoupons.tsx` + `CouponDetailDrawer.tsx`)**
    - Detail drawer adds tabs: "Redemptions" (list from `discount_redemptions` with order/invoice link), "Failed attempts" (list from `discount_redemption_attempts`), "Remaining uses" badge `times_used / max_uses`.

15. **Classes roster (`Classes.tsx` Attendance tab)**
    - Inline quick-mark buttons (Present / No-show / Late) per booking using existing RPC `mark_class_attendance`.
    - "No-show reason" select (sick / no-call / late-cancel / other).
    - Badge "Promoted from waitlist" when `booking.was_waitlisted = true`.
    - "Send WhatsApp reminder" button (single + bulk) using existing `send-whatsapp` edge function with class reminder template.

### D. Memory & docs
- Update `mem://architecture/atomic-rpcs-locker-pt-approval` to add benefit add-on and coupon redemption contracts.
- Add `mem://features/coupon-redemption-engine` with the new RPC contract and tables.
- Update `mem://features/membership-lifecycle-system` reference to point to combined credits view.

### Out of scope (explicitly)
- Full HRM UI for the new payroll engine — the migration ships the engine; UI surfacing is a follow-up.
- Backfilling existing `biometric_photo_url` rows from external public sources beyond simple path parsing (will require an admin tool if needed).

### Acceptance criteria
- Buying a benefit add-on either creates `(invoice, payment, credits)` together or none of them.
- Coupon validation/redemption goes through one RPC; cannot exceed `max_uses` under concurrent redemptions; failed attempts are logged.
- All four EquipmentMaintenance queries filter by selected branch.
- `DeviceManagement.tsx` contains no `iyqqpbvnszyrrgerniog` literal.
- `PersonnelSyncTab.tsx` resolves photos via signed URLs from `biometric_photo_path`.
- All 4 referral-claim entry points call `referralService.claimReward`.
- `compute_payroll` returns per-day classification including late, OT, half-day, holiday, leave, missing checkout, with shift table support.
- New UI surfaces (combined credits, reward lifecycle, redemption history, equipment QR/branch badge, device callback URL, classes quick-attendance) are visible and functional.