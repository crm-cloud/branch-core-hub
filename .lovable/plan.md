

# Audit: HRM Base Pay & Missing Employees

## Issue 1: Base Pay Shows ₹0

**Root cause:** The "Base Pay" column (line 615) displays `proRatedPay`, which is calculated as `(salary / 26) * daysPresent`. When attendance is 0 days, the result is ₹0 — even though the employee's actual salary is ₹15,000.

This is mathematically correct for pro-rated payroll, but misleading. Users expect to see the salary figure, not just the attendance-adjusted amount.

**Fix:** Add a "Base Salary" column showing the full monthly salary (`staff.salary`), and rename the current column to "Pro-rated". This makes the payroll table transparent:

| Staff | Type | Days | Base Salary | Pro-rated | PT Commission | Gross | PF | Net |
|-------|------|------|-------------|-----------|---------------|-------|----|----|
| Manager | Manager | 0/26 | ₹15,000 | ₹0 | - | ₹0 | -₹0 | ₹0 |
| Trainer | Trainer | 0/26 | ₹0 | ₹0 | +₹6,000 | ₹6,000 | -₹0 | ₹6,000 |

**File:** `src/pages/HRM.tsx` — Add "Base Salary" column header + cell, rename "Base Pay" to "Pro-rated Pay".

## Issue 2: Employees Tab Shows Only Staff, Not Trainers

**Root cause:** The Employees tab (line 300) iterates over `employees` from `fetchEmployees()`, which only queries the `employees` table. Trainers live in the `trainers` table. The Payroll tab already fixed this with `fetchAllPayrollStaff()`, but the Employees and Attendance tabs still use the old employees-only data.

**Fix:** Reuse the unified `payrollStaff` list (which merges employees + trainers) for the Employees tab and Attendance tab. This ensures all staff — staff, managers, AND trainers — appear consistently across all HRM tabs.

Changes:
- **Employees tab:** Replace `filteredEmployees` loop with `payrollStaff` filtered by search term. Add Type badge column (same as Payroll tab). Show salary, department, position from unified data.
- **Attendance tab summary cards:** Replace `employees.filter(active)` with `payrollStaff` so trainer attendance cards appear too.
- **Attendance tab log:** Match `staffAttendance` records against `payrollStaff` by `user_id` instead of only `employees`.
- **Stats cards:** Update totals to include trainers (count from `payrollStaff`, sum salaries from `payrollStaff`).

## Files to Change

| File | Change |
|------|--------|
| `src/pages/HRM.tsx` | (1) Add Base Salary column to Payroll table, rename Base Pay → Pro-rated. (2) Replace Employees tab to use `payrollStaff` unified list with Type badge. (3) Replace Attendance tab summary + log to use `payrollStaff`. (4) Update stats to include trainers. |

