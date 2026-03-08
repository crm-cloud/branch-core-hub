

# Audit: Trainer Contracts, Payroll Days, Staff Biometric Access

## Issue 1: Trainers Cannot Create Contracts

**Root cause:** In `HRM.tsx` line 340, the Contract/Edit buttons are wrapped in `{staff.staff_type === 'employee' && staff.employeeRecord && (...)}`. Trainers are excluded because their `staff_type` is `'trainer'`. The `CreateContractDrawer` already supports trainers (it checks `employee.staff_type === 'trainer'` and passes `trainerId`), but the button to open it is hidden.

**Fix:** Show the Contract button for trainers too. Pass the trainer data with `staff_type: 'trainer'` so `CreateContractDrawer` correctly routes to `trainer_id`. Also update the Contracts tab query to join `trainers` alongside `employees` so trainer contracts show names.

## Issue 2: Days Always Show "/26"

**Root cause:** `workingDays` is hardcoded to `26` in `calculatePayrollForStaff` (line 322). This is a standard Indian payroll convention (30 calendar days minus 4 Sundays), but it should reflect the actual working days in the selected month.

**Fix:** Calculate working days dynamically by counting weekdays (Mon-Sat) in the selected month. This gives accurate values like 25 for February, 27 for months with extra Saturdays, etc.

## Issue 3: No Biometric/Device Mapping UI for Staff & Trainers

**Root cause:** The `HardwareBiometricsTab` component (face enrollment, Wiegand ID, device sync status) exists only for **Members** inside `MemberProfileDrawer`. Staff and trainers have no equivalent UI — their avatar upload silently queues a biometric sync, but there's no way to:
- See sync status per device
- Configure Wiegand IDs
- Set custom welcome messages
- Toggle hardware access

**Fix:** Create a `StaffBiometricsTab` component (reusing logic from `HardwareBiometricsTab` but adapted for the `employees`/`trainers` tables) and embed it in both `EditEmployeeDrawer` and `EditTrainerDrawer`. For trainers in HRM, also add an Edit button that opens `EditTrainerDrawer`.

## Files to Change

| File | Change |
|------|--------|
| `src/pages/HRM.tsx` | (1) Show Contract + Edit buttons for trainers. (2) Update Contracts tab query to join trainer names. (3) Add Edit action for trainers opening `EditTrainerDrawer`. |
| `src/services/hrmService.ts` | (1) Calculate working days dynamically instead of hardcoded 26. (2) Include `trainerRecord` in `PayrollStaffItem` for trainers (like `employeeRecord` for employees). |
| `src/components/common/StaffBiometricsTab.tsx` | **New file.** Reusable biometric management tab for staff/trainers: face enrollment photo, Wiegand ID, custom welcome message, device sync status, hardware access toggle. |
| `src/components/employees/EditEmployeeDrawer.tsx` | Embed `StaffBiometricsTab` as a collapsible section for biometric/device settings. |
| `src/components/trainers/EditTrainerDrawer.tsx` | Embed `StaffBiometricsTab` as a collapsible section for biometric/device settings. |

## Implementation Details

### Dynamic Working Days
```ts
function getWorkingDaysInMonth(month: string): number {
  const [year, m] = month.split('-').map(Number);
  const daysInMonth = new Date(year, m, 0).getDate();
  let workingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, m - 1, d).getDay();
    if (day !== 0) workingDays++; // Exclude Sundays only (Mon-Sat = working)
  }
  return workingDays;
}
```

### StaffBiometricsTab Props
```ts
interface StaffBiometricsTabProps {
  staffId: string;        // employee.id or trainer.id
  staffType: 'employee' | 'trainer';  // for biometric service calls
  staffName: string;
  branchId: string;
  biometricPhotoUrl?: string | null;
  biometricEnrolled?: boolean | null;
  wiegandCode?: string | null;
  customWelcomeMessage?: string | null;
  hardwareAccessEnabled?: boolean | null;
}
```

### Trainer Actions in HRM Employees Tab
For trainers, the Contract button passes `{ ...staff, staff_type: 'trainer', id: staff.source_id }` to `CreateContractDrawer`. The Edit button opens `EditTrainerDrawer` with the trainer record fetched via `source_id`.

