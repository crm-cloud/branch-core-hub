

# Plan: Include Trainers in HRM Payroll Processing

## Root Cause

The Payroll tab in HRM only iterates over the `employees` table. Per the system's data model, **trainers are stored in the `trainers` table, not `employees`**. A trainer only appears in payroll if they also have a separate employee record — which is not the standard onboarding flow.

The fix is to **merge trainers into the payroll list** alongside employees, so all salaried staff (staff, managers, AND trainers) appear in a single unified payroll view.

## Approach

### 1. Fetch trainers alongside employees (`src/services/hrmService.ts`)

Add a new function `fetchAllPayrollStaff()` that:
- Fetches all active `employees` (existing logic)
- Fetches all active `trainers` with their profile data
- Merges both into a unified array with a `staff_type` discriminator (`'employee' | 'trainer'`)
- Trainer records map: `salary` from `trainers.salary`, `department` = "Training", `position` = specialization

### 2. Update `calculatePayroll` to accept trainers (`src/services/hrmService.ts`)

Extend `calculatePayroll` to accept an optional `trainerId` parameter:
- If `trainerId` is provided, fetch attendance from `staff_attendance` by the trainer's `user_id` and commissions from `trainer_commissions` by `trainerId`
- Reuse the same pro-rated salary + commission + PF logic

### 3. Update HRM Payroll tab (`src/pages/HRM.tsx`)

- Replace the `employees`-only payroll loop with the unified staff list
- Add a `staff_type` badge (Trainer/Staff/Manager) to each row for clarity
- Trainer rows show their PT commission; employee rows show commission only if they have a linked trainer record (existing behavior)

## Files to Change

| File | Change |
|------|--------|
| `src/services/hrmService.ts` | Add `fetchAllPayrollStaff()`, update `calculatePayroll` to support trainer IDs |
| `src/pages/HRM.tsx` | Use unified staff list in Payroll tab, add staff type badge column |

