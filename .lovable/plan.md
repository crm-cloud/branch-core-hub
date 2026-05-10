# Trainer Edit + Dual-Role Contract Audit

## Findings (root causes)

### 1. Edit Trainer "Personal Details" all blank
`fetchTrainers()` in `src/services/trainerService.ts` only selects `full_name, email, phone, avatar_url` from `profiles` — it never fetches `gender, date_of_birth, address, city, state, postal_code, emergency_contact_name/phone`. So `EditTrainerDrawer` reads `trainer.profile?.date_of_birth` etc. and gets `undefined` → blank fields, even though Bhagirath already has these saved on his profile (entered via Employee record).

### 2. `Failed to create contract: violates foreign key constraint "contracts_employee_id_fkey"`
In `src/pages/Employees.tsx → openContractDrawer()` (line 134), the object passed to `CreateContractDrawer` does **not** include `staff_type`. So inside the drawer:
- `detectAgreementRole(employee)` → falls back to `'staff'`
- `const isTrainer = employee.staff_type === 'trainer'` → **false**
- `employeeId: employee.id` is sent — but `employee.id` is the **trainers.id UUID** (not an `employees.id`), and there is no row in `employees` with that id → FK violation.

DB confirms FK: `contracts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id)` and a CHECK that at least one of `employee_id`/`trainer_id` is set.

### 3. Dual-role payroll (Manager + Trainer) — already deduped, needs UI clarity
`fetchAllPayrollStaff()` in `hrmService.ts` already does:
```ts
const empUserIds = new Set(emps.map(e => e.user_id));
...trainers.filter(t => !empUserIds.has(t.user_id))   // skip trainer row if same user has employee row
```
So Bhagirath's salary is **not** double-counted — payroll uses his employee row (₹25,000 manager salary), and PT commissions are joined in via `trainers` lookup by `user_id` (lines 388–403). This is correct.

What's missing:
- HRM payroll list silently hides the trainer row → users don't realize commissions are still being applied.
- Two separate contracts (one on employee row, one on trainer row) can be created and both shown — confusing.
- Employees page shows two rows (Employee + Trainer) for the same person without any "linked" indicator.

## Plan

### A. Auto-fetch trainer profile (fix blank Edit Trainer)
- `src/services/trainerService.ts` → expand `profiles` select in both `fetchTrainers()` and `getTrainer()` to include: `gender, date_of_birth, address, city, state, postal_code, emergency_contact_name, emergency_contact_phone`.
- Map them onto the returned trainer object as `profile: { ... }` (matching what `EditTrainerDrawer` already reads).

### B. Fix contract creation for trainer rows
- `src/pages/Employees.tsx → openContractDrawer()` — include `staff_type: staff.staff_type` and `branch_id: staff.branch_id` in the `setSelectedEmployee` payload.
- Add a defensive check in `CreateContractDrawer.handleSubmit`: if `employee.staff_type === 'trainer'` send only `trainerId`; if `'employee'` send only `employeeId` (current logic is correct, just needs the flag passed in).

### C. Dual-role guardrail + UI clarity
- In `CreateContractDrawer`, before submitting a trainer contract, look up `employees` by `user_id`; if an active employee contract already exists, show an inline warning: *"This person also has an employee record (EMP-XXXX) with an active contract. Payroll will use the employee salary; this trainer contract should only define commission %."* — non-blocking, lets owner proceed.
- In `Employees.tsx` table, when a `user_id` appears in both `employees` and `trainers`, render a small `Linked` badge on both rows with a tooltip: *"Same user — single payroll, commission added on top."*
- In `HRM.tsx` payroll list, on a row whose user also has a trainer record, show a `+ PT Commission` chip so the dedupe is visible (no math change).

### D. Self-contained answers for the user
- **No new email needed.** Same `bhagirathbhau@gmail.com` keeps both roles.
- **One payroll only.** Manager salary (employee row) + PT commissions (trainer row) — never double base salary.
- **Where to enter trainer commission %:** HRM → Create Contract on the Trainer row → Commission %; salary fields can be left as 0 since base comes from the employee contract.

## Technical changes
| File | Change |
|------|--------|
| `src/services/trainerService.ts` | Expand `profiles` select, return nested `profile` object |
| `src/pages/Employees.tsx` | Pass `staff_type` + `branch_id` in `openContractDrawer` |
| `src/components/hrm/CreateContractDrawer.tsx` | Add dual-role inline warning |
| `src/pages/Employees.tsx` (table) | "Linked" badge for users with both records |
| `src/pages/HRM.tsx` (payroll table) | "+ PT Commission" chip when applicable |

No DB migrations. No payroll math changes (existing dedupe already correct).
