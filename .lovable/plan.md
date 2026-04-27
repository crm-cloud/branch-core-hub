# Production Hardening — Backend Authority Refactor

Goal: every critical workflow runs through ONE backend RPC per domain, with atomic execution, honest statuses (`pending` → `processing` → `completed`/`failed`), and no client-orchestrated multi-step business logic.

---

## Phase 1 — Money & Trust-Critical Workflows

### 1. Approval Workflow Integrity

**Problem:** `ApprovalQueue` flips request → `approved` first, then runs the side-effect. If side-effect fails, you get a misleading approved record.

**Fix:** New SECURITY DEFINER RPC `process_approval_request(p_request_id, p_decision, p_reviewer_notes)` that:
1. Locks the request row (`FOR UPDATE`), guards against double-processing.
2. Transitions request to `processing`.
3. Dispatches by `request_type` to existing internal logic:
   - `freeze_membership` / `unfreeze_membership`
   - `change_trainer`
   - `transfer_membership` / `transfer_branch`
   - `comp_gift` (creates benefit grant + audit row)
4. On success → `approved` + `executed_at` + writes `approval_audit_log`.
5. On failure → `failed` + `failure_reason`, raises so client toasts the real error. Request remains actionable (retry or reject).
6. Rejection path also routed here for a single audit trail.

**Frontend:** `ApprovalQueue.tsx` calls `supabase.rpc('process_approval_request', …)` only — no more multi-step client logic.

**New table:** `approval_audit_log (id, request_id, action, actor_id, success, error_message, payload jsonb, created_at)`.

---

### 2. WhatsApp Benefit / Facility Booking

**Problem:** WhatsApp self-service tools insert `benefit_bookings` + `benefit_usage` directly, bypassing slot lock, entitlement check, duplicate prevention.

**Fix:**
- Refactor `supabase/functions/_shared/ai-tool-executor.ts` `book_facility` and `cancel_booking` tools to call existing `book_facility_slot(...)` / `cancel_facility_slot(...)` RPCs (same as web UI uses via `benefitBookingService`).
- Standardize tool result shape `{ success, booking_id?, error_code?, error_message }` so `whatsapp-webhook` returns the right Meta-friendly text.
- Same path also used by `BookBenefitSlot.tsx` already — confirm and remove any residual direct inserts.

**Adds:** entitlement check, slot row lock, duplicate booking guard, refund on cancel — all enforced by the RPC, not the channel.

---

### 3. Benefit Top-Up / Add-On Sales (GST-aware, atomic)

**Problem:** `TopUpBenefitDrawer` inserts negative `benefit_usage` rows to fake granted credits, then maybe creates an invoice. Not atomic; tax hardcoded to 0; finance/GST reports broken.

**Fix:**
- New table `benefit_credit_grants (id, member_id, benefit_id, branch_id, credits_total, credits_remaining, source, source_invoice_id, expires_at, created_at)` — clean entitlement model, replaces negative-usage hack going forward.
- New RPC `purchase_benefit_topup(p_member_id, p_benefit_id, p_credits, p_unit_price, p_gst_rate, p_payment_method, p_branch_id, p_idempotency_key)`:
  1. Computes subtotal, GST (using existing `useGstRates` source / `gst_rates` table), total.
  2. Creates invoice + invoice_items (benefit add-on line) with proper HSN/SAC.
  3. Records payment via existing `record_payment` RPC (already the unified payment authority — see `mem://architecture/unified-payment-engine-rpc`).
  4. Inserts `benefit_credit_grants` row only after invoice + payment succeed.
  5. Returns `{ invoice_id, payment_id, grant_id }`. Idempotent on `p_idempotency_key`.
- `useBenefitBalance` updated to sum `credits_remaining` across active grants minus positive `benefit_usage`. Backwards compatible: legacy negative `benefit_usage` rows still counted during transition.
- `TopUpBenefitDrawer.tsx` becomes a thin form → single RPC call → toast + invalidate.

---

### 4. PT Package Purchase Settlement

**Problem:** `purchase_pt_package` creates invoice/payment directly, sidestepping unified settlement.

**Fix:** Rewrite RPC to:
1. Create invoice + items (PT package line, HSN, GST).
2. Call `record_payment` (unified authority) — preserves audit and dashboard alignment.
3. Activate `pt_packages_purchased` row.
4. Create `trainer_commissions` row with the configured rate.
5. Idempotent via `p_idempotency_key`.
6. All in one transaction; on any failure → ROLLBACK, raise to client.

Frontend `ptService.purchasePackage` simplified to one RPC call.

---

### 5. Referral Conversion Authority

**Problem:** Admin conversion inserts `referral_rewards` from the client; status update later. Retries can dup rewards.

**Fix:** New RPC `convert_referral(p_referral_id, p_referred_member_id, p_idempotency_key)`:
1. Locks referral row, guards against re-conversion.
2. Links `referred_member_id`.
3. Inserts `referral_rewards` for referrer (and referred, per existing reward rules).
4. Transitions referral to `converted` with `converted_at`.
5. Idempotent (returns existing reward IDs on retry).
6. Triggers existing `notify_referral_converted` flow.

`referralService` + admin `Referrals.tsx` page rewired to call this RPC; remove direct `referral_rewards` inserts.

---

## Phase 2 — Operational Integrity

### 6. Staff Attendance Race Fix

**Problem:** `checkIn` is check-then-insert → duplicate active sessions under concurrency.

**Fix:**
- Migration: partial unique index `CREATE UNIQUE INDEX staff_attendance_one_active_per_user ON staff_attendance(user_id) WHERE check_out IS NULL;`
- New RPC `staff_check_in(p_user_id, p_branch_id, p_method)` wrapping insert; on unique violation returns `{ success: false, message: 'Already checked in', attendance_id }`.
- `staffAttendanceService.checkIn` calls the RPC. `checkOut` already single-row-update — add `FOR UPDATE` via RPC `staff_check_out(p_user_id)` to be safe under double-tap.

---

### 7. Store Discount Redemption Safety

**Problem:** POS updates coupon usage_count after the fact; concurrent checkouts can over-redeem.

**Fix:** New RPC `consume_coupon(p_coupon_code, p_member_id, p_order_total, p_idempotency_key)`:
1. `SELECT … FOR UPDATE` on coupon row.
2. Validates active, within window, under `max_uses`, member-eligible.
3. Computes discount.
4. Increments `current_uses` atomically.
5. Inserts `coupon_redemptions` row keyed by idempotency.
6. Returns discount payload OR raises with structured error.

Store/POS checkout (`storeService` checkout path) calls this BEFORE finalizing the sale; if it fails, sale aborts. On post-checkout cancel, mirror RPC `release_coupon(p_redemption_id)` decrements safely.

---

### 8. Task Management → Operations Tool

**Problem:** Current `tasks` is CRUD-only.

**Schema additions (migration-safe):**
- `tasks`: add `linked_entity_type` (enum: `approval | member | invoice | complaint | booking | lead | none`), `linked_entity_id uuid`, `branch_id` already exists.
- New `task_status_history (id, task_id, from_status, to_status, changed_by, note, created_at)` — fed by AFTER UPDATE trigger when status changes.
- New `task_comments (id, task_id, author_id, body, created_at)` with RLS scoped to assignee/assigner/branch staff.
- New `task_reminders (id, task_id, remind_at, channel, sent_at)` driven by existing `send-reminders` cron.

**Behavior:**
- Branch-aware queries: `fetchTasks` defaults to `branchId` from `BranchContext` for non-owners.
- Trigger on assignment change → inserts a `notifications` row for assignee (existing notification system, see `mem://architecture/realtime-notification-system`).
- Cron extension in `send-reminders`: scans `tasks` where `due_date < now() + interval '24h'` and `status in ('pending','in_progress')`, emits a one-time reminder notification per task per due window. Overdue (>24h past due) escalates to assigner + branch manager.
- `Tasks.tsx`: keep current UI; add a right-side drawer (per Vuexy rule) showing status timeline + comments + linked entity link. No center modals.

---

## Cross-Cutting Rules Preserved

- All new RPCs `SECURITY DEFINER`, `SET search_path = public`, with role checks via existing `has_any_role` / `has_role`.
- All idempotent RPCs key on a client-supplied `p_idempotency_key` and return the original result on replay.
- Honest statuses everywhere: `pending → processing → completed | failed`; never flip to success before the side-effect.
- No regressions to recently fixed flows (member onboarding, payment settlement, reward claim, signed URLs, reminder honesty, measurement privacy).
- UI stays Vuexy: existing drawers stay drawers, no new center modals for forms.

---

## Files Touched (high level)

**New migrations:**
- `approval_audit_log`, `benefit_credit_grants`, `task_status_history`, `task_comments`, `task_reminders`, `coupon_redemptions`, partial unique index on `staff_attendance`, all new RPCs above.

**Edge functions:**
- `_shared/ai-tool-executor.ts` (booking via RPC)
- `send-reminders` (task reminders + escalation)

**Frontend (rewired, not redesigned):**
- `pages/ApprovalQueue.tsx`, `pages/Referrals.tsx`, `pages/Tasks.tsx`
- `components/benefits/TopUpBenefitDrawer.tsx`
- `services/ptService.ts`, `services/referralService.ts`, `services/staffAttendanceService.ts`, `services/storeService.ts`, `services/taskService.ts`, `services/benefitBookingService.ts` (minor)

---

## Acceptance Mapping

| Criterion | Resolved by |
|---|---|
| Approvals only marked approved after execution | §1 RPC + audit log |
| WhatsApp booking uses authoritative RPC | §2 ai-tool-executor refactor |
| Benefit top-ups atomic + GST-aware | §3 `purchase_benefit_topup` |
| PT purchase via unified settlement | §4 rewrite using `record_payment` |
| Referral conversion atomic + retry-safe | §5 `convert_referral` idempotent |
| No duplicate active staff sessions | §6 partial unique index + RPC |
| Coupons can't over-redeem | §7 `consume_coupon` with row lock |
| Tasks have notifications/history/reminders, branch-aware | §8 schema + triggers + cron |

---

## Execution Order

Phase 1 ships first as one approved batch (migrations → RPCs → service rewires → UI wiring → ai-tool-executor). Phase 2 follows in a second pass to keep diffs reviewable. Confirm to proceed and I'll execute Phase 1 end-to-end.