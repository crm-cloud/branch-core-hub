## Final Hardening Sprint — Implementation Plan

This sprint closes the remaining production-grade gaps without regressing recent approval, billing, booking, or reminder fixes. Work ships in 3 phases. Each phase is migration-safe and auditable.

---

### Phase 1 — Trust & Money Hardening

**1.1 Trainer commission reversal**
- New RPC `void_trainer_commission(p_payment_id, p_reason)` — reverses all `trainer_commissions` rows tied to the voided/refunded PT payment by inserting a negative offset row (idempotent on `(source_payment_id, kind='reversal')` unique index).
- Hook it into existing `void_payment` RPC so reversal is atomic with the payment void.
- Supports partial reversals proportional to `voided_amount / original_amount`.

**1.2 Lead → Member conversion authority**
- New RPC `convert_lead_to_member(p_lead_id, p_payload jsonb, p_idempotency_key)` that, in one transaction:
  - Creates the member, links profile/auth user (if exists), branch, optional referral.
  - Updates lead status → `converted` with `converted_member_id`.
  - Enqueues welcome WhatsApp/email via `communication_queue`.
  - Writes `audit_logs` row.
- Returns `{member_id, idempotent_hit: bool}`. Stores `idempotency_key` on the lead so retries are no-ops.
- Refactor `ConvertMemberDrawer.tsx` and `leadService.convertLead` to call only this RPC.

**1.3 Stable idempotency keys for billing**
- Standardize key format: `${memberId}:${intentType}:${draftId}` generated once per draft using `useRef` / `crypto.randomUUID()` cached in component state.
- Audit and fix: `TopUpBenefitDrawer`, `MemberCheckout`, `PaymentDrawer`, PT purchase, store sale flow. Replace any `Date.now()` / per-render UUIDs.
- Add a small `useStableIdempotencyKey(memberId, intent, draftId)` hook in `src/hooks/`.

**1.4 Storage RLS cleanup**
- Audit `storage.buckets` for any `public=true` that holds member-uploaded artifacts (measurements, biometric photos, member docs, signed contracts).
- Make all member-scoped buckets private; switch UI to use signed URL helpers (`memberDocumentUrls`, `biometricPhotoUrls`) — already exists for some; extend to remaining.
- Tighten `storage.objects` policies: list/select restricted to owner (`(storage.foldername(name))[1] = auth.uid()::text`) or staff via `has_role`.

---

### Phase 2 — Operational Resilience

**2.1 Facility slot waitlist**
- New table `benefit_slot_waitlist (id, slot_id, member_id, branch_id, joined_at, notified_at, promoted_at, status)` with unique `(slot_id, member_id)` partial index where `status='waiting'`.
- New RPCs:
  - `join_facility_waitlist(p_slot_id, p_member_id)` — entitlement + duplicate checks.
  - `leave_facility_waitlist(...)`.
- Update `cancel_facility_slot` RPC: on cancellation, `FOR UPDATE` lock waitlist, promote earliest waiter into `benefit_bookings`, mark `promoted_at`, insert notification.
- UI: Add "Join Waitlist" button in `BookBenefitSlot.tsx` when slot is full.

**2.2 Wallet expiry job**
- New RPC `expire_wallet_balances()` — for each wallet entry past `expires_at` with positive balance, write a negative `wallet_ledger` row of type `expiry_reversal` and zero the balance. Idempotent via `(source_id, kind='expiry')` unique index.
- Wire into `send-reminders` edge function (already runs on cron) under a daily branch.

**2.3 Approval audit retention**
- Add `approval_audit_archive` table mirroring `approval_audit_log`.
- New scheduled job `archive_approval_audit_log()` — moves rows older than 365 days into archive, deletes from primary. Wired into `send-reminders` weekly branch.

---

### Phase 3 — Realtime & Hygiene

**3.1 Realtime tasks**
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks, public.task_status_history, public.task_comments;`
- Add `REPLICA IDENTITY FULL` on those tables.
- In `Tasks.tsx` and `TaskDetailDrawer.tsx`, subscribe to postgres_changes filtered by `branch_id` and invalidate React Query keys.

**3.2 Notifications retention + mark-all-read**
- New RPC `cleanup_old_notifications()` — deletes notifications where `created_at < now() - 90 days` AND `is_read=true`; archives unread older than 180 days.
- Wire into `send-reminders` daily.
- Verify `markAllAsRead` button is wired in `NotificationBell.tsx`; fix if missing/broken.

**3.3 Class booking authority cleanup**
- Audit and remove direct `class_bookings` writes from:
  - `src/services/classService.ts` (route through `book_class` / `cancel_class_booking` / `add_to_waitlist` RPCs).
  - `src/components/bookings/ConciergeBookingDrawer.tsx` (concierge path → RPC).
  - `src/pages/AllBookings.tsx` cancel actions → RPC.
  - `src/pages/MemberClassBooking.tsx` member self-book → RPC.
  - `useMemberData.ts` if it does mutations.
- Keep `export-data` / `backup-*` reads as-is (read-only is fine).
- Verify capacity, waitlist promotion, and duplicate protection remain intact.

---

### Technical Notes

- All new RPCs: `SECURITY DEFINER`, `SET search_path = public`, explicit role checks via `has_role(auth.uid(), ...)`.
- All idempotency: enforced by partial unique indexes, not just code checks.
- All scheduled jobs piggyback on existing `send-reminders` cron to avoid new pg_cron entries.
- No edits to `supabase/integrations/...types.ts`, `client.ts`, or `.env`.
- Migrations are additive; no destructive drops on production tables.

### Files Touched (preview)

- New migration consolidating Phase 1+2+3 SQL (RPCs, tables, indexes, publications, retention archives).
- `src/services/{leadService,classService,ptService,walletService,taskService}.ts`
- `src/components/{bookings/ConciergeBookingDrawer,leads/ConvertMemberDrawer,benefits/TopUpBenefitDrawer,tasks/TaskDetailDrawer,notifications/NotificationBell}.tsx`
- `src/pages/{AllBookings,MemberClassBooking,BookBenefitSlot,Tasks,MemberCheckout}.tsx`
- `src/hooks/useStableIdempotencyKey.ts` (new)
- `supabase/functions/send-reminders/index.ts` (extend with wallet expiry, approval archive, notification cleanup branches)

### Acceptance Verification

After each phase: type-check clean, RPC smoke-tested via `supabase--read_query` / `curl_edge_functions`, partial unique indexes verified to block duplicates, storage policies tested with anon vs owner vs staff role.
