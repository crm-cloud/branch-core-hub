

# Fix: "Unknown User" in Audit Logs + Member Facility Booking Broken

## Issue 1: "Unknown User" in Audit Logs

**Root Cause Found:** There are TWO audit trigger functions on the same tables, creating duplicate entries:

| Old trigger (broken) | New trigger (works) |
|---|---|
| Function: `log_audit_change` | Function: `audit_log_trigger_function` |
| Trigger names: `audit_employees`, `audit_members`, etc. | Trigger names: `audit_employees_trigger`, `audit_members_trigger`, etc. |
| Does NOT populate `actor_name` or `action_description` | Correctly fetches user name from profiles |

The old `log_audit_change` triggers fire alongside the new ones, inserting rows with NULL `actor_name`. The UI falls back to "Unknown User" for those.

**Affected tables with duplicate triggers:** employees, trainers, members, memberships, invoices, payments

**Fix (Database Migration):**
- Drop all old triggers that use `log_audit_change` (audit_employees, audit_members, audit_trainers, audit_memberships, audit_invoices, audit_payments)
- Drop the old `log_audit_change` function
- Backfill existing NULL `actor_name` rows by looking up `user_id` in the `profiles` table
- Also add missing triggers for tables like `classes`, `leads`, `lockers` that only have one trigger but it's the old one (no actor_name)

**Fix (UI - `src/pages/AuditLogs.tsx`):**
- Update the fallback display: when `actor_name` is NULL, look up the `user_id` from the log entry in profiles (or display "System" if no user_id exists)
- Filter out known duplicate entries (same timestamp + table + record_id but different trigger)

---

## Issue 2: Members Cannot See Ice Bath / Sauna Facilities

**Root Cause Found:** The `ensure_facility_slots` RPC function has a **type mismatch bug** that causes it to crash silently every time a member visits the booking page.

The error:
```
ERROR: operator does not exist: date = text
QUERY: NOT EXISTS (SELECT 1 FROM benefit_slots WHERE ... AND slot_date = v_current_date::TEXT ...)
```

The `slot_date` column is type `DATE`, but the function compares it against `v_current_date::TEXT`. This type mismatch makes the RPC fail, so zero slots are ever generated, and the Recovery tab shows nothing.

The same bug affects the INSERT statement where `slot_date`, `start_time`, and `end_time` are cast to `TEXT` but the columns are `DATE` and `TIME` types.

**Fix (Database Migration):**
- Recreate `ensure_facility_slots` function with correct type casts:
  - Change `slot_date = v_current_date::TEXT` to `slot_date = v_current_date`
  - Change `v_current_date::TEXT` in INSERT to `v_current_date`
  - Change `v_slot_start::TEXT` and `v_slot_end::TEXT` to `v_slot_start` and `v_slot_end`

---

## Issue 3: Class Booking / Cancel UI/UX Improvements

**Current state:** The Agenda cards work but the Cancel button is a small outline button that blends in. Booked items don't stand out enough.

**Fix (in `src/pages/MemberClassBooking.tsx` AgendaCard component):**
- Make booked items more visually distinct with a green left-border accent and a "Booked" badge
- Make the Cancel button red/destructive variant so it's clearly a cancel action
- Add a confirmation step before cancellation (to prevent accidental taps)
- Show facility name (Ice Bath / Sauna) more prominently on recovery cards
- Improve the empty state for Recovery filter to say "No recovery slots available -- facilities may be closed today"

---

## Files Summary

| File | Change |
|---|---|
| Database migration | 1. Drop old duplicate audit triggers + `log_audit_change` function. 2. Backfill NULL actor_name from profiles. 3. Fix `ensure_facility_slots` type casts. 4. Add missing audit triggers for classes/leads/lockers |
| `src/pages/AuditLogs.tsx` | Better fallback for NULL actor_name (show "System" badge instead of "Unknown User") |
| `src/pages/MemberClassBooking.tsx` | UI/UX polish: booked state styling, red cancel button, confirmation dialog, better empty states |

---

## Execution Order

1. Database migration (fixes both the audit duplicates AND the slot generation crash)
2. AuditLogs.tsx UI fix (display cleanup)
3. MemberClassBooking.tsx UI/UX improvements (booking cards polish)
