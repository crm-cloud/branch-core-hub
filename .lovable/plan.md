# Audit Log Coverage Expansion + UX Overhaul

## Current State (audited)

**Audit triggers attached to:** `members`, `memberships`, `invoices`, `payments`, `trainers`, `employees`, `leads`, `lockers`, `classes`, `device_access_events`, `access_devices`. Plus a status-only logger on `benefit_bookings`.

**Missing coverage** (user-requested + others that matter for accountability):
- `tasks`, `equipment`, `equipment_maintenance`
- `member_comps`, `lead_followups`
- `benefit_bookings` (full row audit, not just status), `class_bookings`
- `contracts`, `member_documents`, `staff_attendance`
- `pt_packages`, `pt_sessions`, `member_pt_packages`
- `products`, `expenses`, `wallet_transactions`, `referrals`
- `announcements`, `campaigns`, `coupon_redemptions`
- `membership_plans`, `branches`, `user_roles`, `integration_settings`

**UI gaps in `/audit-logs`:**
- Shows raw table name (`Trainers`) and an 8-char record ID — operator has no idea *which* trainer/member/invoice was touched.
- Actor filter is a free-text search; no dropdown of staff.
- No filter by category (Member · Billing · Operations · Marketing · System).
- "Description" is generic ("Updated trainers row").
- No quick "View this record" deep-link.

---

## Plan

### Part A — Backend: extend audit coverage

1. **One migration** that attaches `audit_log_trigger_function` to all missing tables listed above (AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW), guarded with `DROP TRIGGER IF EXISTS` for idempotency.
2. **Replace the booking status trigger** on `benefit_bookings` with the standard audit trigger (full snapshots), and add the same to `class_bookings`.
3. **Skip noisy/system tables** (`audit_logs`, `error_logs`, `notifications`, `communication_logs`, `webhook_*`, `mips_*` raw events, `device_access_events` writes from biometric polls if too noisy — keep as-is for now).

### Part B — Backend: smarter actor + target labels

4. **Enhance `audit_log_trigger_function`** to also populate a new `target_name TEXT` column with a human label per table:
   - members/leads → `full_name`
   - invoices → `invoice_number`
   - payments → `reference_id || amount`
   - memberships → member's full_name + plan
   - tasks → `title`
   - equipment → `name || serial_number`
   - lockers → `locker_number`
   - bookings → facility/class name
   - contracts → contract number
   - others → fallback to `name`/`title`/`label`/`code` column if present, else NULL
   
   Implementation: a small SECURITY DEFINER helper `_resolve_audit_target_name(table_name, row jsonb) RETURNS text` with a CASE statement — keeps the trigger lean and lets us add tables later without touching the trigger body.
5. **Improve `action_description`** to use the resolved target name: `"Updated invoice INV-2026-0123"`, `"Created task — Call back lead"`, `"Cancelled membership for Rajat Sharma"`.
6. Add column `target_name` (text, nullable) on `audit_logs` + index `(table_name, target_name)`.

### Part C — Frontend: `/audit-logs` UX overhaul

7. **Display target prominently** — replace the bare table badge with `"<Action> <TargetName>"` as the primary line, table name moved to a small grey badge.
8. **Actor filter dropdown** — populated from distinct `actor_name` in audit_logs (last 90 days) instead of free text.
9. **Category filter** mapping table groups → label:
   - Members & Leads (members, leads, memberships, lead_followups, member_comps)
   - Billing (invoices, payments, expenses, wallet_transactions)
   - Operations (lockers, equipment, equipment_maintenance, tasks, contracts, attendance)
   - Bookings (benefit_bookings, class_bookings, classes, pt_sessions)
   - Catalog (products, plans, pt_packages, membership_plans)
   - Marketing (announcements, campaigns, coupon_redemptions, referrals)
   - Staff & System (employees, trainers, user_roles, integration_settings, branches)
10. **Show actor role badge** (resolved via a left join to `user_roles` in the query).
11. **"Open record" deep link** — when target table maps to a known route (members/{id}, invoices/{id}, leads/{id}, …), render a small arrow button on the row that opens it.
12. **Better empty-state copy** + a "Last 24h / 7d / 30d / 90d" quick-range chip row above the date pickers.
13. **CSV export** updated to include `target_name`, `actor_role`.

---

## Out of scope (call out, do not implement now)

- Backfilling `target_name` and `action_description` for historical rows — too expensive; new rows will be correct, old rows stay as-is with their existing data visible in the JSON drawer.
- Audit ring-buffer pruning / archival policy — separate concern.
- Per-user "what did I change today" page — can be derived from the new actor filter.

## Technical notes

- All triggers use the existing `audit_log_trigger_function` (already returns NEW/OLD correctly after the recent fix), so the trigger body stays in one place.
- The `_resolve_audit_target_name` helper uses `jsonb` field accessors with `COALESCE` — no per-table joins, zero extra queries per write.
- Frontend changes are confined to `src/pages/AuditLogs.tsx` plus a small `audit-route-map.ts` for deep links.
