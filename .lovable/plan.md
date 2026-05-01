## Goal

Two parallel hardening tracks:
1. **System Health** — turn `error_logs` into a real observability surface with deduped fingerprinting, used everywhere, with alerts.
2. **Atomic critical RPCs** — lockers, approvals, PT purchase, trainer commission reversal, staff attendance, GST, and HRM payroll fixes.

---

## Part A — System Health with real logs

### A1. Schema migration (extend `error_logs`)

Add columns (keep existing rows compatible, all nullable except defaults):

```text
fingerprint        text          -- sha256(severity|source|function_name|route|normalized_message)
occurrence_count   integer  DEFAULT 1
first_seen         timestamptz  DEFAULT now()
last_seen          timestamptz  DEFAULT now()
function_name      text
table_name         text
request_id         text
release_sha        text
```

Indexes:
- `UNIQUE (fingerprint) WHERE status='open'` — collapses repeated open errors.
- `(severity, created_at DESC)`, `(branch_id, created_at DESC)`, `(status, last_seen DESC)`.

### A2. `log_error_event` RPC (SECURITY DEFINER)

Signature:
```text
log_error_event(
  p_severity text,           -- info|warning|error|critical
  p_source text,             -- frontend|edge_function|database|trigger|cron|webhook
  p_message text,
  p_function_name text DEFAULT NULL,
  p_route text DEFAULT NULL,
  p_table_name text DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL,
  p_release_sha text DEFAULT NULL,
  p_stack text DEFAULT NULL,
  p_context jsonb DEFAULT NULL
) RETURNS uuid
```

Behavior: compute fingerprint, `INSERT ... ON CONFLICT (fingerprint) WHERE status='open' DO UPDATE SET occurrence_count = error_logs.occurrence_count + 1, last_seen = now(), context = EXCLUDED.context`. Returns log id.

### A3. Edge-function helper

Upgrade `supabase/functions/_shared/capture-edge-error.ts` to call `log_error_event` directly (still fire-and-forget). Wire into:
- `payment-webhook`, `verify-payment`, `create-razorpay-link`, `create-payment-order`
- `whatsapp-webhook`, `meta-webhook`, `mips-webhook-receiver`, `howbody-*-webhook`
- `send-reminders`, `run-retention-nudges`, `lead-nurture-followup`, `process-scheduled-campaigns`, `process-comm-retry-queue`
- `send-email`, `send-sms`, `send-whatsapp`, `send-broadcast`, `send-message`
- `deliver-scan-report`, `howbody-report-pdf`, `backup-export`, `backup-import`

Wrap each handler in `try { ... } catch (e) { await captureEdgeError(name, e, { branch_id, severity:'error', context }); throw }`.

### A4. Database trigger error capture

Add `EXCEPTION WHEN OTHERS THEN PERFORM log_error_event('error','trigger',SQLERRM, ...)` to critical triggers (`handle_new_feedback`, `handle_payment_*`, MIPS sync, etc.) without swallowing the failure for the caller.

### A5. Frontend client errors

Lightweight `src/lib/errorReporter.ts` that calls `log_error_event` via supabase RPC. Hook into the existing global `ErrorBoundary` and an unhandled-promise-rejection listener in `src/main.tsx`. Include `route`, `release_sha` (from Vite env), `user_id`.

### A6. System Health UI rebuild (`src/pages/SystemHealth.tsx`)

Sections:
- KPI strip: error rate (24h), unresolved critical, failed jobs, failed messages, failed payments, failed storage uploads.
- **Top errors by fingerprint** table: severity badge, source, message, occurrences, first/last seen, branch, route. Row → drawer with stack, context, related events.
- Filters: severity, source, branch, status, time range.
- Failed jobs: query `communication_logs WHERE status='failed'`, `payments WHERE status='failed'`, storage failures from logs.
- Actions: Mark resolved, Reopen, Bulk resolve, Clear resolved >90 days, **Export CSV** (uses `csvExport.ts`).
- Realtime: subscribe to `error_logs` insert/update for live updates.

### A7. Alerts

- pg_cron job `error_alerts_check` (every 5 min): if `count(*) FILTER (severity='critical', last_seen > now()-interval '5 min') >= threshold`, insert into `notifications` for users with role `owner|admin` and call `send-whatsapp`/`send-email` via existing dispatchers.
- Threshold + channels stored in `organization_settings.alert_config` jsonb.

---

## Part B — Lockers, Approvals, PT, Commission, GST, Staff Attendance, HRM

### B1. GST helpers (single source of truth)

New SQL functions in migration:
```text
calc_gst(p_amount numeric, p_rate numeric, p_inclusive boolean)
  RETURNS TABLE(taxable numeric, cgst numeric, sgst numeric, igst numeric, total numeric)

resolve_gst_rate(p_item_type text, p_item_id uuid, p_branch_id uuid)
  RETURNS numeric
```
Used by all RPCs below + invoice item insertion. Frontend `useGstRates` continues to read defaults.

### B2. Lockers — atomic RPCs

Replace existing `assign_locker_with_invoice` with hardened `assign_locker_with_billing`:
- `SELECT ... FOR UPDATE` on `lockers` row, assert `status='available'`.
- Insert `locker_assignments`, set `lockers.status='occupied'`.
- If `p_chargeable`: create invoice + invoice_items with GST via `calc_gst`, return `invoice_id`.
- Wrapped in single transaction; raises typed error codes (`LOCKER_TAKEN`, `MEMBER_INACTIVE`).

`release_locker(p_assignment_id uuid, p_release_date date)`:
- Lock assignment + locker, set assignment `is_active=false, end_date=release_date`, `lockers.status='available'`.

Update `AssignLockerDrawer.tsx` and `Lockers.tsx` to call only these RPCs (remove client-side multi-step writes).

### B3. Approvals — `process_approval_request` is the only mutation path

Keep the existing RPC name; rewrite body to:
- Lock approval row, assert status `pending`.
- For each `approval_type` (freeze/unfreeze/trainer_change/transfer/branch_move/comp/refund/discount), execute the side effect inside the same transaction. On failure → raise; status stays `pending`.
- Only after side effects succeed, set `status=approved|rejected`, `reviewed_by/at`, `review_notes`, write `approval_audit_log`.

Strip side-effect mutations from `src/pages/ApprovalQueue.tsx` — UI calls the RPC and handles error toast.

### B4. PT package purchase via unified payment

Drop legacy `purchase_pt_package` overloads; keep one definitive signature:
```text
purchase_pt_package(
  p_member_id, p_package_id, p_branch_id, p_trainer_id,
  p_total_amount, p_amount_paid, p_payment_method,
  p_payment_link_id text, p_gst_rate numeric,
  p_received_by uuid, p_idempotency_key text
) RETURNS jsonb  -- { invoice_id, member_pt_package_id, payment_id, status }
```
- Creates `member_pt_packages` row (sessions ledger).
- Creates invoice + invoice_items with GST via `calc_gst`.
- Calls `record_payment` for the paid portion (handles partial → status `partial`, zero → `pending`).
- Inserts pending `trainer_commissions` row tied to `source_payment_id`.
- Idempotent on `p_idempotency_key`.

Update `src/services/ptService.ts` and PT purchase drawers accordingly.

### B5. Trainer commission reversal

- Add trigger on `payments`/`invoices` status change: if a PT-linked payment becomes `refunded|voided|cancelled`, insert reversing `trainer_commissions` row (`kind='reversal'`, negative `amount`, `reverses_commission_id` set, `status='approved'`). Original commission marked `status='reversed'`.
- Manual refund endpoint also calls `reverse_trainer_commission(p_payment_id)`.

### B6. Staff attendance reliability

- Partial unique index: `CREATE UNIQUE INDEX staff_attendance_one_open ON staff_attendance(user_id) WHERE check_out IS NULL;`
- RPCs:
  - `staff_check_in(p_user_id, p_branch_id, p_source text, p_device_id uuid)`: lock by user, assert no open row, insert.
  - `staff_check_out(p_user_id, p_notes text)`: update the single open row; raise if none.
- Update `src/services/staffAttendanceService.ts` and biometric webhook (`mips-webhook-receiver`) to use these RPCs.

### B7. HRM payroll engine

New `compute_payroll(p_user_id uuid, p_period_start date, p_period_end date)` returning per-day rows + summary:
- Joins `staff_attendance`, `staff_shifts`, `holidays`, `leave_requests`, `payroll_rules`.
- Rules: late (>15 min), early checkout, missing checkout (auto-close at shift end + flag), half-day (<50% hours), overtime (>shift+30min), weekly off, holiday, approved leave (paid/unpaid), duplicate attendance (collapsed), payable days = present + paid leave + holidays.
- Output stored in `payroll_runs` + `payroll_run_lines` (new tables) for audit.
- HRM UI shows per-employee breakdown with anomaly badges.

---

## Files to create / modify

### Migrations
- `error_logs` columns + indexes + `log_error_event` RPC + alerts cron.
- `assign_locker_with_billing`, `release_locker`.
- New `process_approval_request` body.
- New `purchase_pt_package` (drop overloads).
- Commission reversal trigger + `reverse_trainer_commission`.
- Staff attendance unique index + `staff_check_in`/`staff_check_out`.
- `calc_gst`, `resolve_gst_rate`.
- `compute_payroll` + `payroll_runs`, `payroll_run_lines` tables.

### Edge functions
- `_shared/capture-edge-error.ts` upgraded to call `log_error_event`.
- Try/catch + capture in all listed webhook/cron/sender functions.

### Frontend
- `src/lib/errorReporter.ts` + wire into ErrorBoundary + `main.tsx`.
- `src/pages/SystemHealth.tsx` rebuilt (KPI, fingerprint table, drawer, filters, export, realtime).
- `src/components/lockers/AssignLockerDrawer.tsx`, `src/pages/Lockers.tsx` → use new RPCs.
- `src/pages/ApprovalQueue.tsx` → call `process_approval_request` only.
- `src/services/ptService.ts` + PT purchase drawer → new `purchase_pt_package` signature.
- `src/services/staffAttendanceService.ts` + StaffAttendance UI → new RPCs.
- HRM payroll page → consume `compute_payroll`.
- New `src/lib/gst.ts` mirroring `calc_gst` for client previews.

### Memory updates
- `mem://architecture/observability-error-logs` (fingerprint contract).
- `mem://architecture/atomic-rpcs-locker-pt-approval` (no client-side multi-step writes).
- `mem://features/hrm-payroll-engine` (rule precedence).

---

## Acceptance criteria

- Repeated identical errors show one row with incrementing `occurrence_count`.
- All listed edge functions log failures to `error_logs`; SystemHealth shows them live.
- Locker assignment cannot double-book under concurrent calls.
- Approval status only flips after side effect commits.
- PT purchase supports partial/pending/payment-link with GST line items and idempotency.
- Refunding a PT payment auto-creates a reversing commission row.
- Staff cannot have two open attendance rows; check-in/out via RPC only.
- Payroll handles late/early/missing/half/OT/leave/holiday/duplicates correctly.
- GST values across memberships, PT, lockers, store, benefits, invoices come from one helper.
- Critical-error spike triggers WhatsApp/email alert to owners.
