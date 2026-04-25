# Audit-Driven Lifecycle Hardening — Round 3

Goal: Eliminate every remaining direct-write path that bypasses authoritative RPCs, fix structural conflicts in storage RLS, and stop overstating delivery for reminders/WhatsApp.

---

## P0 — Financial integrity (must route through unified payment authority)

### 1. PT package purchases → `settle_payment`
**File:** `purchase_pt_package` RPC (DB) + `src/services/ptService.ts`
- Migration: refactor `purchase_pt_package(_member_id, _package_id, _trainer_id, _branch_id, _price_paid)` so it:
  1. Creates the `member_pt_packages` row in `pending_payment` state (or equivalent).
  2. Inserts a draft invoice with `status='pending'`.
  3. Calls `public.settle_payment(...)` with `p_payment_source='pt_purchase'` and an idempotency key derived from `member_pt_packages.id`.
  4. On settlement success, marks the PT package `active`.
- Removes the direct `payments` insert and the manual `invoices.status='paid'` update currently inside the function.
- Client (`ptService.purchasePTPackage`) signature unchanged.

### 2. Benefit add-on purchases → `settle_payment`
**File:** `src/services/benefitBookingService.ts:483-544` (`purchaseBenefitCredits`)
- Replace the "manufacture invoice → insert payment → insert credits" sequence with a new RPC `public.purchase_benefit_credits(p_member_id, p_membership_id, p_package_id, p_branch_id, p_payment_method, p_idempotency_key)`.
- RPC creates invoice → calls `settle_payment` → only inserts `member_benefit_credits` after settlement returns success → returns the credit row.
- Guarantees: no orphan paid invoice without credits; single transaction.

### 3. POS checkout → `settle_payment` (wallet-safe)
**File:** `src/services/storeService.ts:228-354` (`createPOSSale`)
- Wrap the entire flow in a new RPC `public.create_pos_sale(p_payload jsonb)` that:
  1. Validates wallet balance via row-locked `SELECT … FOR UPDATE` on `member_wallets`.
  2. Validates coupon eligibility (locked).
  3. Inserts `pos_sales` + `invoices` + `invoice_items` in `pending` state.
  4. If wallet portion > 0: debits wallet inside the same txn, inserts `wallet_transactions`.
  5. Calls `settle_payment` for the remaining cash/card/UPI portion (or for the full wallet portion as an internal payment record).
  6. Updates `inventory` and `discount_codes.times_used`.
  - Any failure rolls back atomically. No invoice is ever marked paid before wallet debit succeeds.
- Client `createPOSSale` becomes a thin `supabase.rpc('create_pos_sale', { p_payload })` call.

---

## P1 — Lifecycle authority

### 4. Benefit slot booking → `book_facility_slot` / `cancel_facility_slot`
**File:** `src/pages/BookBenefitSlot.tsx`
- Replace direct `supabase.from('benefit_bookings').insert(...)` with `supabase.rpc('book_facility_slot', { p_slot_id, p_member_id, p_membership_id })`.
- Replace direct status update for cancel with `supabase.rpc('cancel_facility_slot', { p_booking_id, p_reason })` (verify signature; if missing add a thin RPC that wraps the existing cancel logic + benefit-credit refund).
- Toast surfaces RPC error message verbatim (capacity full, no entitlement, duplicate, etc.).

### 5. Locker assignment + invoice → atomic RPC
**Files:** new RPC + `src/services/lockerService.ts` + `src/components/lockers/AssignLockerDrawer.tsx`
- New migration: `public.assign_locker_with_invoice(p_locker_id, p_member_id, p_start_date, p_end_date, p_fee_amount, p_months, p_chargeable boolean)`:
  - Locks the locker row, verifies `status='available'`.
  - Inserts `locker_assignments` and flips `lockers.status='assigned'`.
  - If `p_chargeable`: inserts pending invoice + invoice items in the same transaction (no `settle_payment` here — it remains a receivable; member pays later).
  - Returns `{assignment_id, invoice_id}`.
- `lockerService.assignLocker` collapses to a single RPC call. Failure rolls back both steps.

### 6. Force-entry attendance → `member_force_check_in` RPC
**Files:** new RPC + the force-entry override action (search for direct `member_attendance` insert in attendance dashboard).
- New `public.member_force_check_in(p_member_id, p_branch_id, p_actor_user_id, p_reason text)`:
  - Acquires advisory lock per member.
  - If an open `member_attendance` row exists (no `check_out`), return `{success:false, reason:'already_checked_in', attendance_id}` — caller can decide to close-and-reopen or no-op.
  - Otherwise inserts attendance with `method='force'` and writes an `audit_logs` row.
- Replace the raw insert in the override handler with this RPC.

---

## P1 — Storage, communication, delivery integrity

### 7. Biometric storage RLS compatibility
**Problem:** New helper writes `biometric/members/{uuid}.jpg`, but the `member-photos` policy uses `extract_member_id_from_storage_path` which only reads the **first** path segment as a UUID. `biometric` is not a UUID → RLS denies upload/read.
**Fix (migration):**
- Add helper `public.extract_biometric_owner_from_storage_path(_path text) returns uuid` that parses `biometric/(members|trainers|employees)/{uuid}.jpg` and returns the UUID, plus the entity type.
- Add new RLS policies on `storage.objects` scoped to `bucket_id='member-photos'` AND `name LIKE 'biometric/%'` for SELECT/INSERT/UPDATE/DELETE that authorize:
  - members: the member themself OR staff (admin/manager/owner/staff at the member's branch).
  - trainers/employees: themselves OR admin/manager/owner at their branch.
- Existing measurement-photo policies untouched (different prefix).

### 8. Banner uploads → public `ad-banners` bucket
**File:** `src/components/banners/AdBannerManager.tsx`
- Migration:
  ```sql
  insert into storage.buckets (id, name, public) values ('ad-banners','ad-banners',true) on conflict do nothing;
  ```
  Plus RLS: public read; insert/update/delete restricted to admin/manager/owner.
- Update upload code to `supabase.storage.from('ad-banners').upload(...)` and `getPublicUrl` (now valid because bucket is public).
- One-time backfill is out of scope; existing broken URLs will be replaced on next edit.

### 9. Honest reminder delivery for ALL types
**File:** `supabase/functions/send-reminders/index.ts`
- Extend the same pattern already used for payment reminders to: membership expiry, class, PT, benefit, and any other reminder types currently only writing in-app notifications.
- For each reminder:
  - Resolve channels per `reminder_configurations` (whatsapp/sms/email).
  - Invoke `send-whatsapp` / `send-sms` / `send-email` per channel; capture success/error.
  - Persist per-channel status into the existing `delivery_status` / `last_error` columns (add columns via migration if missing for the other reminder tables).
  - Only mark `status='sent'` if at least one outbound channel succeeded; otherwise `status='failed'` or `'skipped'` with reason.
- Stop writing `communication_logs.status='sent'` for membership expiry unless an outbound provider acknowledged.
- In-app notifications remain a separate side-effect, not a substitute.

### 10. WhatsApp attachment send must respect provider response
**File:** the WhatsApp chat send-attachment handler (`src/components/whatsapp/WhatsAppChat.tsx` or equivalent)
- After `supabase.functions.invoke('send-whatsapp', ...)` for attachments:
  - If `error` or `data.success === false`: do NOT invalidate as if delivered, mark the just-inserted message row `status='failed'` with `last_error`, and toast the actual provider error.
  - Only on confirmed success: invalidate chat queries and toast "Attachment sent".
- Mirror the text-message path's handling (which already does this, per recent fixes).

---

## Migrations summary
1. `purchase_pt_package` rewrite (uses `settle_payment`).
2. `purchase_benefit_credits` new RPC.
3. `create_pos_sale` new RPC (atomic wallet+settlement).
4. `cancel_facility_slot` (verify exists; add if missing) with refund logic.
5. `assign_locker_with_invoice` new RPC.
6. `member_force_check_in` new RPC.
7. Biometric storage helper + 4 RLS policies on `storage.objects` for `biometric/%` prefix.
8. Create public `ad-banners` bucket + RLS.
9. Add `delivery_status` / `last_error` columns to remaining reminder-tracking tables if not present.

## Code changes summary
- `src/services/ptService.ts` — no change (RPC signature stable).
- `src/services/benefitBookingService.ts` — `purchaseBenefitCredits` collapses to RPC call.
- `src/services/storeService.ts` — `createPOSSale` collapses to RPC call.
- `src/pages/BookBenefitSlot.tsx` — book/cancel via RPC.
- `src/services/lockerService.ts`, `src/components/lockers/AssignLockerDrawer.tsx` — atomic RPC.
- Force-entry attendance handler — RPC.
- `src/components/banners/AdBannerManager.tsx` — switch bucket to `ad-banners`.
- `supabase/functions/send-reminders/index.ts` — outbound dispatch for all reminder types.
- WhatsApp attachment send handler — error-aware.

## Acceptance criteria
1. PT, benefit add-on, and POS sales never produce a paid invoice without the matching entitlement / wallet debit.
2. All paid transactions flow through `settle_payment` and benefit from idempotency, audit, and post-settlement triggers (membership activation, hardware sync, referral conversion).
3. Benefit booking enforces capacity locks and entitlement via `book_facility_slot`; cancellations refund credits via RPC.
4. Locker assignment + invoice are atomic — no orphan assignments without receivables.
5. Force-entry cannot create duplicate active attendance rows.
6. Biometric photo uploads under `member-photos/biometric/...` succeed for the rightful owner and authorized staff under RLS.
7. Banner uploads render correctly after save (public bucket).
8. No reminder is marked `sent` (and no `communication_logs.status='sent'` row is written) unless an outbound provider call actually succeeded; failed/skipped channels are recorded honestly.
9. WhatsApp attachment failures surface to staff and do not show "Attachment sent".

## Non-regressions
- Existing successful payment flows continue to work without changes to client signatures.
- Measurement photo RLS unaffected.
- In-app notifications still fire alongside outbound delivery.
- Recent member-profile, document-vault, and referral lifecycle improvements remain intact.
