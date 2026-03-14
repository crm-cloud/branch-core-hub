

# Unified Attendance Command Center + Device Management Refactor + Weekly Off Logic

## Overview
Three interconnected changes: (1) merge the two attendance pages into one Command Center, (2) refactor Device Management for India CGNAT reality, (3) add weekly_off logic for staff/trainers.

---

## 1. Consolidate Attendance into Single Command Center

**Current state**: Two pages exist — `/attendance` (Attendance.tsx, member quick check-in with search/flash) and `/attendance-dashboard` (AttendanceDashboard.tsx, unified hub with tabs for members/staff/history).

**Plan**: Merge the rapid-entry search bar + flash banner from `Attendance.tsx` into `AttendanceDashboard.tsx`, then remove `Attendance.tsx` and point `/attendance` route to the dashboard.

| File | Change |
|------|--------|
| `src/pages/AttendanceDashboard.tsx` | Add the `useAttendance` hook for member check-in/out/search. Add the rapid-entry search bar (auto-focus, barcode-ready, `h-14` input) and flash banner at the top, above stats. Add `check_in_method` source badge (manual/device/force_entry) to member attendance table rows. |
| `src/App.tsx` | Change `/attendance` route to render `AttendanceDashboardPage` instead of `AttendancePage`. Remove `AttendancePage` import. Add redirect from `/attendance` → `/attendance-dashboard` or just render same component at both paths. |
| `src/config/menu.ts` | Change all `href: '/attendance'` entries to `href: '/attendance-dashboard'` for staff/manager/admin roles. |
| `src/pages/Attendance.tsx` | Delete file (no longer needed). |

---

## 2. Device Management Refactor (CGNAT-friendly)

**Problem**: IP/Port fields are useless in Indian CGNAT networks. The device dials out using its Serial Number as identifier.

**Plan**: Make Serial Number the primary identifier field. Make IP Address optional (auto-populated by heartbeat). Add hardware capabilities checkboxes stored in `config` JSON column. Replace "Device Type" dropdown with capability checkboxes.

| File | Change |
|------|--------|
| `src/components/devices/AddDeviceDrawer.tsx` | Replace IP/Port as required fields with Serial Number as required. Make IP optional (placeholder: "Auto-detected from heartbeat"). Add checkboxes: Facial Recognition, Wiegand Card Reader, Relay Turnstile Control (stored in `config`). Remove IP validation requirement. |
| `src/components/devices/EditDeviceDrawer.tsx` | Same refactor — SN primary, IP optional, capability checkboxes. |
| `src/services/deviceService.ts` | Update `addDevice` to make `ip_address` default to `'0.0.0.0'` if not provided. Add `serial_number` as required. Store capabilities in `config` JSON. |
| `src/pages/DeviceManagement.tsx` | Show SN prominently in device table instead of IP. Show heartbeat indicator (green if `last_heartbeat` < 60s ago). Display capability badges from `config`. |

---

## 3. Weekly Off Logic for Staff/Trainers

**Problem**: Staff/trainers not showing up on Sundays get marked "Absent" — but if Sunday is their day off, it should be "Weekly Off" (WO), not affecting payroll.

**Plan**: Add `weekly_off` column to `employees` and `trainers` tables (default: `'sunday'`). Use this in the attendance history/payroll to differentiate WO from Absent.

| File | Change |
|------|--------|
| DB Migration | `ALTER TABLE employees ADD COLUMN weekly_off TEXT DEFAULT 'sunday';` and `ALTER TABLE trainers ADD COLUMN weekly_off TEXT DEFAULT 'sunday';` |
| `src/pages/AttendanceDashboard.tsx` | In History tab summary, show "WO" days count alongside present/absent. When computing absent days, exclude the employee's `weekly_off` day. |
| `src/services/hrmService.ts` | Update `getWorkingDaysInMonth()` to accept a `weeklyOffDay` parameter (default `0` = Sunday). Exclude that day from working days count. Update payroll calculation to use per-employee weekly_off. |
| `src/pages/HRM.tsx` | Show weekly_off info in payroll view. |
| `src/components/employees/AddEmployeeDrawer.tsx` | Add "Weekly Off Day" dropdown (Mon-Sun, default Sunday). |
| `src/components/employees/EditEmployeeDrawer.tsx` | Same dropdown for editing. |
| `src/components/trainers/AddTrainerDrawer.tsx` | Same dropdown. |
| `src/components/trainers/EditTrainerDrawer.tsx` | Same dropdown. |

---

## Execution Order

1. **DB Migration**: Add `weekly_off` column to employees and trainers
2. **Attendance Consolidation**: Merge pages, update routes and menu
3. **Device Management Refactor**: SN-first, capabilities, heartbeat indicator
4. **Weekly Off in Payroll/History**: Update HRM service and attendance history
5. **Employee/Trainer Drawers**: Add weekly_off dropdown

