# Production Hardening — Status & Audit

## ✅ Phase 1 Complete (money & trust-critical)

| Workflow | Authority | Notes |
|---|---|---|
| Approvals | `process_approval_request` RPC + `approval_audit_log` | Honest `pending → processing → approved/failed`, server-side execution per `request_type` |
| WhatsApp/AI booking | `book_facility_slot` / `cancel_facility_slot` via `_shared/ai-tool-executor.ts` | Slot lock, entitlement, dup-guard enforced channel-agnostic |
| Benefit top-ups | `purchase_benefit_topup` RPC | Atomic invoice + GST + `record_payment` settlement + grant |
| PT package purchase | `purchase_pt_package` (8-arg) | Single transaction; commission row created |
| Referral conversion | `convert_referral` RPC | Idempotent rewards, transition guarded |

## ✅ Phase 2 Complete (operational integrity)

| Workflow | Authority | Notes |
|---|---|---|
| Staff attendance | `staff_check_in` / `staff_check_out` + partial unique index | No double active sessions |
| Store coupons | Row-locked validate + `coupon_redemptions` audit row inside `create_pos_sale` | `consume_coupon` / `release_coupon` available for non-POS callers |
| Tasks: schema | `linked_entity_*` cols, `task_status_history`, `task_comments`, `task_reminders` | Triggered status logging + assignee notification |
| Tasks: UI | `TaskDetailDrawer` (Vuexy right-side sheet) — comments, history, reminders, linked entity link | Branch-aware list via `useBranchContext` |
| Tasks: cron | `send-reminders` v3 — sections 8a/8b/8c | Explicit reminder rows + due-soon scan + overdue escalation to assigner & branch managers |

---

## Cross-cutting guarantees

- All new/updated RPCs are `SECURITY DEFINER` with `SET search_path = public` and explicit role checks.
- Idempotency keys carried end-to-end (POS coupon row now keyed by `${posSaleId}:coupon`).
- No more "approved but unfinished" status transitions.
- Communications routed through universal dispatcher (no hard-coded providers).

---

## 🔎 Next-pass audit — known remaining gaps

These are not regressions; they are still-thin spots worth a follow-up sprint:

1. **Class booking** still uses direct inserts in some places — should mirror `book_facility_slot` pattern with a `book_class_slot` RPC enforcing capacity + waitlist.
2. **Trainer commissions** are inserted at PT purchase but adjustments on refund/void aren't reversed automatically — need `void_trainer_commission` hook in `void_payment`.
3. **Lead → Member conversion** still client-orchestrated; should become `convert_lead_to_member` RPC (mirroring `convert_referral`).
4. **Facility slot waitlist**: today users see "slot full" — add `benefit_slot_waitlist` table + auto-promote on cancellation inside `cancel_facility_slot`.
5. **Wallet expiry** is enforced read-side only; add nightly job in `send-reminders` to expire stale balances and create ledger reversal entries.
6. **Audit log retention**: `approval_audit_log` has no retention/archival policy — should add 365-day partition rotation.
7. **Idempotency hygiene**: `record_payment` and `settle_payment` both accept idempotency keys but the UI sometimes regenerates them on retry — wrap user-facing mutations with stable keys keyed off `(member_id, intent_type, draft_id)`.
8. **Realtime tasks**: `tasks` table is not yet on `supabase_realtime` publication — add it so the Task drawer/comments feel live.
9. **Notifications cleanup**: `notifications` table grows unbounded; add a 90-day retention policy and a "mark all read" action on the bell.
10. **Storage RLS audit**: a few public buckets allow listing (linter WARN 4–9) — tighten or move user uploads to scoped paths.

---

## Acceptance map (current)

| Criterion | Status |
|---|---|
| Approvals only marked approved after execution | ✅ Phase 1 §1 |
| WhatsApp booking via authoritative RPC | ✅ Phase 1 §2 |
| Benefit top-ups atomic + GST-aware | ✅ Phase 1 §3 |
| PT purchase via unified settlement | ✅ Phase 1 §4 |
| Referral conversion atomic + retry-safe | ✅ Phase 1 §5 |
| No duplicate active staff sessions | ✅ Phase 2 §6 |
| Coupons can't over-redeem & audited | ✅ Phase 2 §7 (POS row-lock + redemption row) |
| Tasks: notifications + history + reminders + branch-aware | ✅ Phase 2 §8 |
