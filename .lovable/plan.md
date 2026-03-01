

# Comprehensive Audit & Fix Plan

## Issue 1: Locker Released After Payment Collection
**Root cause:** The locker assignment itself works correctly. The issue is likely that when a membership payment is collected and the invoice status changes to "paid", there is NO trigger that releases lockers. However, looking at the `lockerService.assignLocker`, the `end_date` is calculated as `assignMonths * 30 days` from now — independent of membership duration. The real problem is: the locker `end_date` doesn't sync with membership `end_date`. When membership expires and auto-expire triggers fire, lockers remain assigned but the UI may filter by member active status, making it appear released.

**Fix:** No auto-release bug exists in code. The perceived issue is that locker duration is independent of membership. Add an option in `AssignLockerDrawer` to "Sync with membership end date" which auto-fills the duration based on the member's active membership `end_date`. Also add a visual indicator on the Lockers page showing locker assignment expiry date clearly.

## Issue 2: Redesign All Bookings Page with Calendar View
**Current state:** Single-date table view with tabs for classes/benefits/PT. No calendar.

**Fix:** Redesign `AllBookings.tsx` with:
- A week/month calendar view (using a simple custom calendar grid, not a heavy library) showing booking dots per day
- Click a day to see that day's bookings in a side panel
- Keep the existing list/table view as a tab option ("List View" vs "Calendar View")
- Cleaner stat cards and modern Vuexy styling

## Issue 3: Payment Edit/Correction Workflow
**Current state:** No edit capability on payments. Once recorded, it's permanent.

**Fix:** Add a "Void & Correct" workflow (industry standard — never edit financial records directly):
- Add a "Void Payment" button (admin/owner only) that marks the payment as `voided` and creates a reversal entry
- Add "Record Correction" which creates a new corrective payment linked to the voided one
- Add `voided` to payment status display
- Add `void_reason` and `voided_by` fields via migration
- Show voided payments with strikethrough styling

## Issue 4: System Health — Expand Beyond Frontend Errors
**Current state:** Only captures frontend React errors via ErrorBoundary. Doesn't track backend/edge function/database errors.

**Fix:** 
- Add edge function error logging: wrap edge function catch blocks to insert into `error_logs` with `source = 'edge_function'`
- Add a `source` column to `error_logs` (frontend, edge_function, database, trigger)
- In SystemHealth page, add tabs/filters by source
- Add a "Database Health" section that queries `pg_stat_activity` or shows recent failed queries from audit logs

## Issue 5: Trainers Page — Show All Branches + Improve Profile
**Root cause:** `useTrainers(branchId, !showInactive)` filters by `branchId`. When "All Branches" is selected, `branchFilter` may be empty but `effectiveBranchId` still points to one branch.

**Fix:** When `branchFilter` is empty/null (meaning "All Branches"), pass empty string to fetch ALL trainers across branches. Update `fetchTrainers` service to skip `branch_id` filter when empty. In `TrainerProfileDrawer`, add General Clients tab showing members with `assigned_trainer_id = trainer.id`, matching the member profile drawer pattern.

## Issue 6: Audit Reminders — Birthday, Renewals, Expiry, Inactive Members
**Current state:** `send-reminders` edge function already handles birthdays, membership expiry (7/3/1 days), payment reminders, class/PT/benefit booking reminders. But does NOT handle "member not visiting for 7+ days".

**Fix:** Add an "Inactive Member Alert" section to `send-reminders`:
- Query `member_attendance` for active members whose last `check_in` was > 7 days ago
- Generate notification for admin/staff: "Member X hasn't visited in Y days"
- Generate notification for member: "We miss you! Visit the gym today"

## Issue 7: Staff Dashboard — Inactive Members Tab
**Current state:** Staff dashboard has follow-up leads but no inactive member tracking.

**Fix:** Add an "Inactive Members" card to `StaffDashboard.tsx`:
- Query members with active membership whose last attendance was > 7 days ago
- Show member name, phone, last visit date, days since last visit
- Add quick action buttons: Call, WhatsApp, Send Reminder
- This helps staff with retention outreach

## Issue 8: Lead Status — "Interested" Not in DB Enum + Redesign
**Root cause:** The `lead_status` enum in the database is: `new`, `contacted`, `qualified`, `negotiation`, `converted`, `lost`. The UI shows `interested` which does NOT exist in this enum. That's why changing status to "interested" fails silently.

**Fix:**
- Update `Leads.tsx` Select options to match actual DB enum: `new`, `contacted`, `qualified`, `negotiation`, `converted`, `lost`
- Redesign Leads page with:
  - Kanban board view (columns per status) as default view
  - Calendar view showing follow-up dates
  - List/table view as alternate tab
  - Search, source filter, date range filter
  - Pagination (show 50 per page with load more)
  - Modern Vuexy card styling

---

## Database Migration Required

```sql
-- Add source column to error_logs for tracking origin
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS source text DEFAULT 'frontend';

-- Add void fields to payments for correction workflow  
ALTER TABLE payments ADD COLUMN IF NOT EXISTS void_reason text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_by uuid;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS original_payment_id uuid REFERENCES payments(id);
```

## Files to Change

| File | Change |
|------|--------|
| **DB Migration** | Add `source` to `error_logs`, void fields to `payments` |
| `src/pages/AllBookings.tsx` | Redesign with calendar + list view toggle, cleaner UI |
| `src/pages/Leads.tsx` | Fix status enum values, redesign with kanban/calendar/list views, pagination |
| `src/pages/Payments.tsx` | Add "Void Payment" action for admin, show voided payments |
| `src/pages/SystemHealth.tsx` | Add source filter tabs, expand error tracking scope |
| `src/pages/Trainers.tsx` | Fix "All Branches" filtering to show trainers across all branches |
| `src/services/trainerService.ts` | Skip `branch_id` filter when empty string |
| `src/components/trainers/TrainerProfileDrawer.tsx` | Add General Clients tab alongside PT Clients |
| `src/pages/StaffDashboard.tsx` | Add "Inactive Members" card (no visit in 7+ days) |
| `src/components/lockers/AssignLockerDrawer.tsx` | Add "Sync with membership" duration option |
| `supabase/functions/send-reminders/index.ts` | Add inactive member alerts (7+ days no visit) |

## Execution Order
1. DB migration (error_logs source, payment void fields)
2. Fix lead status enum mismatch (critical bug)
3. Add inactive member tracking to send-reminders + staff dashboard
4. Fix trainers "All Branches" filtering
5. Redesign Leads page (kanban + calendar + list)
6. Redesign All Bookings page (calendar view)
7. Add payment void/correct workflow
8. Expand System Health tracking
9. Enhance trainer profile drawer + locker sync option

