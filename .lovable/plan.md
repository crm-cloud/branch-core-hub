# P3 — End-to-End Workflow Hardening

Targets the six gaps from the workflow inspection. Builds on existing primitives (`record_payment`, `dispatch-communication`, `log_error_event`, `lifecycle_state`) — no rewrites of working flows.

## 4.1 Member onboarding & profile lifecycle

**Sensitive document URLs**
- Audit `src/components/members/**` and `src/lib/documents/memberDocumentUrls.ts` to confirm every ID proof / contract / medical doc render uses `createSignedUrl(..., 60)` — never `getPublicUrl`.
- Add `signMemberDocument(path, ttl)` helper with 60s default + 5min cap; route all member doc reads through it.
- Migration: ensure `member-documents` storage bucket is `public=false`; tighten RLS so only branch staff + the member themselves can read their own paths.

**Lifecycle state machine**
- `members.lifecycle_state` already exists. Add CHECK constraint: `created | pending_verification | verified | active | suspended | archived`.
- Add `member_lifecycle_transitions` audit table (member_id, from_state, to_state, actor_id, reason, created_at).
- New RPC `transition_member_lifecycle(p_member_id, p_to_state, p_reason)` — validates allowed transitions, writes audit row, atomic.
- Frontend: `MemberStatusBadge` reads `lifecycle_state` (not derived booleans).

## 4.2 Membership lifecycle — atomic orchestration

**`purchase_membership` RPC** (single transaction)
- Inputs: `p_member_id, p_plan_id, p_branch_id, p_start_date, p_discount, p_payment_method, p_amount_paid, p_locker_id?, p_referral_code?, p_idempotency_key`.
- Inside one txn: insert `memberships` → insert `invoices` + `invoice_items` → call `record_payment` → optional `assign_locker` → trigger `referral_conversion` → enqueue post-commit reminders via `pg_notify('membership_created', ...)`.
- Rolls back the entire purchase if any step fails. Returns `{ membership_id, invoice_id, payment_id }`.
- Idempotency: unique index on `(p_idempotency_key)` in a new `purchase_attempts` table.

**Freeze / unfreeze / cancel** — wrap existing logic in `freeze_membership` / `cancel_membership` RPCs with the same audit + post-commit event pattern. Frontend services call RPCs; no multi-step client writes remain.

**Post-commit eventing**
- Listener edge function `on-membership-created` consumes `pg_notify` and dispatches welcome WA + reminder schedule via `dispatch-communication`. Decouples comms from the financial txn.

## 4.3 Payment & invoice reconciliation

`record_payment` already atomic. Add reconciliation safety net:

- **Daily job** `reconcile-payments` (pg_cron, 02:30 IST) — checks for the previous day:
  1. `invoices.amount_paid` == SUM(`payments.amount` WHERE invoice_id = i.id AND status='success').
  2. `wallet_transactions` net == `wallet_balances.balance` per member.
  3. Razorpay captured payments without a matching `payments` row (drift detector).
- Drift writes to `reconciliation_findings` table + `log_error_event` with severity `warn`, surfaces in `SystemHealth`.
- New RPC `reverse_payment` already exists; ensure refund flows route through it (audit existing call sites).

## 4.4 Biometric / MIPS — canonical upsert + branch targeting

- Standardize biometric upsert key to `(member_id, branch_id, device_id)`. Add unique index, replace any per-row delete-then-insert in `sync-to-mips` with `INSERT ... ON CONFLICT (member_id, branch_id, device_id) DO UPDATE`.
- Mandatory branch resolution: `resolveMipsTargets({ branchId, deviceIds? })` helper — throws if `branchId` missing. All MIPS proxy calls must go through it.
- Add `mips_sync_attempts` table (member_id, branch_id, device_id, attempt_no, last_error, next_retry_at) for visibility and capped retries (max 5, exponential backoff).

## 4.5 Reminders & notifications

Already have `dispatch-communication` + `dedupe_key` + member preferences (Wave 4). Closing remaining gap:

- Migrate the last 3 senders (`send-reminders`, `notify-lead-created`, `run-retention-nudges`) to invoke `dispatch-communication` instead of writing `communication_logs` directly. CI guard already blocks regressions.
- Add `notification_dispatch_summary` view (last 24h: sent / queued / deduped / suppressed / failed by category) — surfaced in `CommunicationFunnelCard`.

## 4.6 WhatsApp — delivery lifecycle & retry queue

**Status lifecycle**
- `whatsapp_messages.status` already supports `pending|sent|delivered|read|failed`. Add columns `sent_at`, `delivered_at`, `read_at`, `failed_at`, `failure_reason`, `failure_code`, `retry_count`.
- `meta-webhook` already receives status callbacks — extend to populate timestamp columns (transition is monotonic; never downgrade `read → delivered`).
- View `whatsapp_delivery_health` (last 24h) — sent vs delivered vs failed % per template.

**Observable retry queue**
- New table `whatsapp_send_queue` (message_id, attempts, next_attempt_at, last_error, status). Max 3 attempts, backoff 1min / 5min / 30min.
- `process-whatsapp-retry-queue` cron (every 2 min) re-invokes `dispatch-communication` for queued messages.
- Failed-after-retries → `log_error_event` `severity=error`, surfaces in SystemHealth with member context for manual follow-up.

## Frontend
- `MemberStatusBadge`, `MembershipPurchaseDrawer`, `ReconciliationFindings` page (admin), `WhatsAppDeliveryHealth` card on SystemHealth.
- Replace direct `supabase.from('memberships').insert(...)` in `CreateMembershipDrawer` with `purchase_membership` RPC call.

## Technical artifacts

```text
supabase/migrations/<ts>_p3_workflow_hardening.sql
  ├─ member_lifecycle_transitions + transition_member_lifecycle()
  ├─ purchase_attempts + purchase_membership() + freeze_membership() + cancel_membership()
  ├─ reconciliation_findings + reconcile_payments_daily()
  ├─ mips_sync_attempts + biometric upsert unique index
  ├─ whatsapp_messages.{sent_at,delivered_at,read_at,failed_at,failure_reason,retry_count}
  ├─ whatsapp_send_queue + dequeue/process RPCs
  └─ whatsapp_delivery_health + notification_dispatch_summary views

supabase/functions/
  ├─ on-membership-created/  (pg_notify listener)
  ├─ reconcile-payments/     (cron 02:30 IST)
  └─ process-whatsapp-retry-queue/ (cron */2 min)

src/
  ├─ services/membershipService.ts   → purchase_membership RPC
  ├─ services/lifecycleService.ts    → transition_member_lifecycle
  ├─ services/mipsService.ts         → resolveMipsTargets
  ├─ lib/documents/signMemberDocument.ts
  ├─ pages/SystemHealth.tsx          → + reconciliation + WA health cards
  └─ components/system/{ReconciliationFindingsCard,WhatsAppDeliveryHealthCard}.tsx
```

## Out of scope
- Refactor of working comms preference UI (already shipped Wave 3).
- Razorpay webhook signature changes (already verified).
- New WA template authoring UI.

## Outcome
All six P3 gaps closed → readiness target **9.6/10**. Every multi-step financial/entitlement write becomes a single server transaction; sensitive docs are signed-URL only; comms have full delivery telemetry and bounded retries.