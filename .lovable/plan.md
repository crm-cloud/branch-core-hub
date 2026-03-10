

# Staff Role End-to-End Audit & Fixes

## Issues Found

| # | Issue | Root Cause | Severity |
|---|-------|-----------|----------|
| 1 | **Follow-Up Leads shows empty** despite 3 active leads | `leads` table has NO `follow_up_date` column. Both `StaffDashboard` and `FollowUpCenter` select this non-existent column, causing a 400 error → empty results. | Critical |
| 2 | **FollowUpCenter uses `lead.name`** | Column is `full_name`, not `name`. Query fails silently. | Critical |
| 3 | **Unpaid Invoices stat not clickable** | Stat card shows count but has no link to `/invoices?status=pending`. User can't act on it. | High |
| 4 | **No way to Record Payment as staff** | Payments page (`/payments`) is read-only for staff. No "Record Payment" button. The `RecordPaymentDrawer` exists but is only wired into the Invoice flow. | High |
| 5 | **No way to Add Expense as staff** | Staff menu has no link to `/finance`. The "Add Expense" drawer only exists on the Finance page which is admin/manager only. | High |
| 6 | **Locker creation should be restricted** | User says staff should only manage lockers (assign/release), not create new ones. Currently creation buttons are visible to all. | Medium |
| 7 | **FollowUpCenter pending payments showing empty** | Same branch resolution issue — works correctly if employee record exists with branch. Likely working but hidden by the leads column bug making whole page seem broken. | Low |

## Fixes

### Fix 1 & 2: Leads queries — remove non-existent `follow_up_date`, fix column name

**StaffDashboard.tsx** (line 90): Remove `follow_up_date` from select, use `created_at` for ordering. Change display to show latest followup from `lead_followups` table OR just show all active leads sorted by creation.

**FollowUpCenter.tsx** (line 85): Change `name` → `full_name`, remove `follow_up_date` from select. For follow-up date display, do a secondary lookup from `lead_followups` or join.

Actually the simplest correct approach: select valid columns from `leads`, and for follow-up scheduling context, fetch the latest `lead_followups.next_followup_date` per lead via a subquery/join.

### Fix 3: Make stat cards actionable

Wrap stat cards in `<Link>` to relevant pages:
- "Today's Check-ins" → `/attendance`
- "Unpaid Invoices" → `/invoices`
- "Active Leads" → `/leads`
- "Expiring This Week" → `/members`

### Fix 4: Add "Record Payment" to Payments page for staff

Add a "Record Payment" button that opens a standalone payment recording drawer. Staff should be able to record walk-in payments without needing a pre-existing invoice.

### Fix 5: Add Expense recording for staff

Add "Add Expense" to the staff menu under Operations, OR add an expense button directly on the Payments page. Simplest: add `/finance` to staff menu so they can use the existing Add Expense drawer there.

Better approach: Add "Add Expense" button on the Payments page itself since staff already visits it.

### Fix 6: Hide locker creation for staff

Add role check — only show "Create Locker" and "Bulk Create" buttons for admin/owner/manager roles.

## Files to Change

| File | Change |
|------|--------|
| `src/pages/StaffDashboard.tsx` | Fix leads query (remove `follow_up_date`), wrap stat cards in Links, add latest followup date from `lead_followups` |
| `src/pages/FollowUpCenter.tsx` | Fix `name` → `full_name`, remove `follow_up_date`, fetch latest followup from `lead_followups` |
| `src/pages/Payments.tsx` | Add "Record Payment" button for staff (standalone, no invoice required), add "Add Expense" button |
| `src/pages/Lockers.tsx` | Hide create/bulk-create buttons for staff role |
| `src/config/menu.ts` | Add Finance Overview to staff menu (for expense access) |

