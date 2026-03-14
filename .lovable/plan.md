

# Simplify Payroll: Use Actual Attendance Days (No Weekly Off Needed)

## The Insight

Your gym is 24/7 with no fixed holidays. Trainers/staff work based on duty rosters — some come on Sundays, some don't. The face attendance machine (or manual check-in) already captures exactly who showed up.

**The fix is simple**: Instead of calculating "working days" by excluding Sundays or a weekly off day, just use **calendar days in the month** as the denominator and **actual attendance days** (from `staff_attendance` table) as the numerator.

```text
Pro-rated Pay = (Base Salary / Calendar Days in Month) × Days Present
```

No need for `weekly_off` column, no need for "Include Sundays" toggle. The attendance machine IS the source of truth.

## Changes

| File | Change |
|------|--------|
| `src/services/hrmService.ts` | Simplify `getWorkingDaysInMonth()` → just return total calendar days. Remove `includeSundays`/`weeklyOffDay` params. Rename to `getDaysInMonth()` for clarity. Update `calculatePayrollForStaff` and `calculatePayroll` to use it. |
| `src/pages/HRM.tsx` | Remove "Include Sundays" checkbox. Remove `includeSundays` state. Payroll table shows "Days Present / Total Days" instead of "Days Present / Working Days". |
| `src/pages/AttendanceDashboard.tsx` | In History tab, remove weekly_off logic. Just show days present vs calendar days. Mark days with no attendance as "—" (not "Absent" or "WO"). |
| `src/components/employees/EditEmployeeDrawer.tsx` | Remove "Weekly Off Day" dropdown (no longer needed). |

The `weekly_off` column added in the previous migration can stay in the DB (harmless) — we just stop using it in payroll calculations. The attendance data from face machine + manual check-ins already tells us exactly how many days each person worked.

