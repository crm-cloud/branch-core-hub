

# Fix 400 Error, System Health Clear, and Infrastructure Hardening

## Root Cause: 400 on Staff Attendance

The `staff_attendance` table has **zero foreign key constraints**. The query `profiles:user_id(full_name, email)` relies on PostgREST detecting a FK relationship between `staff_attendance.user_id` and `profiles.id`. Since no FK exists, PostgREST returns `400 Bad Request: Could not find a relationship`.

**Fix**: Add a FK constraint from `staff_attendance.user_id` → `profiles.id`, then issue `NOTIFY pgrst, 'reload schema'`.

---

## Changes

| # | File / Target | Change |
|---|--------------|--------|
| 1 | **DB Migration** | `ALTER TABLE staff_attendance ADD CONSTRAINT staff_attendance_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);` + `NOTIFY pgrst, 'reload schema';` — This is the single fix for the 400 error on all staff attendance queries across AttendanceDashboard, StaffAttendance, and HRM pages. |
| 2 | `src/pages/SystemHealth.tsx` | The "Clear Resolved" and "Resolve All" buttons were already added in a previous edit. Verify they're working — no additional changes needed unless the current code is broken. |
| 3 | `src/main.tsx` | **No change needed** — `ErrorBoundary` already wraps `App` at the highest level (line 114 of App.tsx), which includes `AuthProvider` and `BrowserRouter`. Auth crashes ARE captured. |

## Benefit Add-on Testing Note

The benefit purchase → invoice/payment flow was wired in the previous iteration. To verify end-to-end:
- Purchase an Ice Bath/Sauna add-on for a member
- Check that an invoice appears in `/invoices` with type `benefit_addon`
- Check that a payment record appears in `/payments`
- Confirm the credits show in the member's Benefits tab

## Execution

1. Run the single migration to add the FK constraint (fixes the 400 immediately)
2. Verify the System Health bulk actions are functional
3. No code changes needed — the queries already use the correct `profiles:user_id(...)` syntax; they just needed the FK to exist

