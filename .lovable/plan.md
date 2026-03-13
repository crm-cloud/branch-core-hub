

# Unified Attendance, Payment Collection, Payroll Flexibility, and Error Cleanup

## Issues Found

### 1. No UI to Record Manual Staff Attendance + Merge Member & Staff Attendance
**Problem**: The Staff Attendance page (`StaffAttendance.tsx`) has a "Record Staff Attendance" card but it shows NO actual check-in/out buttons for individual staff — only a text message. The `employees` query is fetched in the hook but never used in the UI. The `todayAttendance` data only shows already-checked-in people, so there's nobody to act on.

Additionally, member attendance (`/attendance`) and staff attendance (`/staff-attendance`) are separate pages with separate menus.

**Fix**:
- **Merge** into a single **Unified Attendance Hub** at `/attendance` with tabs: "Members" | "Staff" | "History"
- **Staff tab**: Show all employees/trainers from the branch with Check In / Check Out buttons (using the existing `useStaffAttendance` hook). Include a date range picker for history view.
- **History tab**: Show staff attendance for custom period (month picker, date range) with summary stats per person (days present, total hours).
- Remove the separate `/staff-attendance` route and redirect it to `/attendance`.
- Update sidebar menu: remove "Staff Attendance" from Admin & HR section; the `/attendance` link already covers both.

### 2. System Health Errors — Bulk Resolve Known Issues
**Problem**: Open errors include:
- `DialogContent requires DialogTitle` (accessibility warnings on analytics, approvals, leads, attendance) — need to add `DialogTitle` with `VisuallyHidden` wrapper
- `Cannot coerce to single JSON object` (settings, staff-attendance, all-bookings) — `.single()` calls returning 0 or 2+ rows
- `Could not find relationship between profiles and trainers` (leads) — bad join syntax
- `biometric ON CONFLICT` — already fixed in previous migration

**Fix**: Address the code-level root causes:
- Add missing `DialogTitle` to any `DialogContent` missing it (GlobalSearch `CommandDialog` already fixed, but check other dialogs)
- Fix `.single()` calls that may return 0 rows → use `.maybeSingle()`
- Fix leads profile-trainer join syntax

### 3. Record Payment Drawer — Show Overdue Invoices
**Problem**: The Payments page "Record Payment" drawer only searches members but doesn't show their pending/overdue invoices. The user has to guess the amount.

**Fix**: After selecting a member, fetch their pending/partial/overdue invoices and display them as selectable cards. When an invoice is selected, auto-fill the due amount and link the payment to that invoice. This matches how `RecordPaymentDrawer` in the invoices section works, but the Payments page version is disconnected.

### 4. Graceful Payment Collection — Overdue/Partial Payment Workflow
**Problem**: No centralized "Dues Collection" view exists. Overdue invoices are scattered across member profiles.

**Fix**: Add a **"Dues Collection"** section at the top of the Payments page — a collapsible card showing all overdue/partial invoices with member info, amount due, and quick "Collect" / "Send Link" actions. This gives reception staff a single dashboard for outstanding payments.

### 5. Email System
**Problem**: No `email_send_log` table exists. The `communicationService.sendEmail()` only opens a `mailto:` link — there's no actual email sending infrastructure.

**Clarification**: The system does not have a built-in email sending service. Currently, emails are handled via:
- Auth emails (password reset, verification) — handled by the backend automatically
- `mailto:` links for manual emails

To add actual email sending, we'd need to set up email infrastructure (custom domain + SMTP). This is a separate initiative. For now, I'll note this as a known limitation — no code changes needed unless you want to set up the email infrastructure.

### 6. HRM Payroll — Sunday Working Days
**Problem**: `getWorkingDaysInMonth()` hardcodes `day !== 0` (excludes all Sundays). Some gyms operate on Sundays.

**Fix**: Add a configurable "working days" setting. For now, add a toggle in the HRM payroll UI: "Include Sundays" checkbox. When checked, use all calendar days (minus any holidays) instead of excluding Sundays. Store this as a branch-level setting in `organization_settings`.

---

## Files to Change

| File | Change |
|------|--------|
| `src/pages/AttendanceDashboard.tsx` | Add "Staff" tab with manual check-in/out buttons for all branch employees/trainers, and "History" tab with date range for staff attendance |
| `src/config/menu.ts` | Remove "Staff Attendance" from admin/manager menus (merged into `/attendance`) |
| `src/pages/Payments.tsx` | After member selection, fetch overdue invoices and show selectable invoice cards; add "Dues Collection" summary card at top |
| `src/pages/HRM.tsx` | Add "Include Sundays" toggle to payroll tab |
| `src/services/hrmService.ts` | Update `getWorkingDaysInMonth()` to accept `includeSundays` parameter |
| `src/components/search/GlobalSearch.tsx` | Verify DialogTitle exists (accessibility fix) |
| Various pages | Fix `.single()` → `.maybeSingle()` for settings/bookings queries causing coerce errors |

## Execution Order

1. Merge attendance pages (biggest UX improvement)
2. Payment collection — overdue invoices in Record Payment drawer + Dues Collection card
3. Payroll Sunday toggle
4. System health error fixes
5. Email system documentation (no code change — inform user of limitation)

