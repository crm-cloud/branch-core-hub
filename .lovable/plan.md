## Audit Findings

### 1. "Base Salary saved but contract appears blank"

The contract IS being inserted into the `contracts` table (verified `createContract` in `src/services/hrmService.ts` lines 149–181 — it writes `salary`, `base_salary`, `commission_percentage`, `terms`, etc.). The blankness is a **display/join bug** in `src/pages/HRM.tsx` (lines 108–154):

```ts
.select(`*, employees(employee_code, user_id, position, department,
  profiles:employees_user_id_profiles_fkey(full_name, email, phone)),
  trainers(user_id, specializations)`)
```

This uses an **auto-generated FK alias** (`employees_user_id_profiles_fkey`) which the project memory explicitly bans — when PostgREST can't resolve it, the embedded `profiles` row returns null, so `_resolvedName / _resolvedCode / salary cells` render as `N/A` / blank. Also `branch_id` is never written on `createContract`, so any future branch-scoped policies/queries will hide the row.

### 2. "Where to enter DOB / address / government ID / salary / commission?"

`EditEmployeeDrawer.tsx` only exposes: department, position, salary, salary_type, bank_name, bank_account, tax_id, is_active. It does **not** expose:
- `profiles.date_of_birth`, `address`, `city`, `state`, `postal_code`, `government_id_type`, `government_id_number`, `emergency_contact_name/phone`, `gender`, `phone`, `full_name`
- Trainer-specific commission % (currently only set on the contract, not on the employee/trainer row)

So after creating Bhagirath, there is literally no UI surface to edit personal info — staff have to go to the database, exactly as the user did.

---

## Plan

### A. Fix Create Contract save + list (`src/pages/HRM.tsx`, `src/services/hrmService.ts`, `src/components/hrm/CreateContractDrawer.tsx`)

1. In `createContract` service, also persist `branch_id` (read from `employee.branch_id` passed in by the drawer).
2. In `CreateContractDrawer.handleSubmit`, pass `branchId: employee.branch_id` to the service.
3. In `HRM.tsx` `all-contracts` query, **drop the auto-gen FK alias** and use two explicit lookups instead (per project memory rule on Supabase joins):
   - Fetch `contracts` with `employees(id, employee_code, user_id, position, department, branch_id)` and `trainers(id, user_id, specializations, commission_percentage)`.
   - Then batch-fetch `profiles` for the union of `employees.user_id ∪ trainers.user_id` and merge in JS for `_resolvedName / Email / Phone`.
4. Add a tiny success toast detail confirming the saved base salary + commission so the operator sees what was stored.

### B. Make the Edit Employee drawer the single place to manage all staff details

Refactor `src/components/employees/EditEmployeeDrawer.tsx` into a tabbed Sheet (right-side, per project Form Standards) with three tabs:

1. **Personal** (writes to `profiles` row of `employee.user_id`): full_name, phone, gender, date_of_birth, address, city, state, postal_code, emergency_contact_name, emergency_contact_phone, government_id_type (PAN/Aadhaar/Passport/DL), government_id_number.
2. **Employment** (writes to `employees`): department, position, salary, salary_type, bank_name, bank_account, tax_id, weekly_off, is_active. Show `employee_code` and `hire_date` as read-only.
3. **Biometrics** — keep existing `StaffBiometricsTab`.

For trainers (`employee.staff_type === 'trainer'` or routed from Trainers page), show an extra **Commission** field that writes to `trainers.commission_percentage` via the existing trainer service.

Use a single submit that runs the profile update and employee update in parallel, then `invalidateQueries(['hrm-employees','employees','branch-managers','trainers'])`.

### C. Apply the same coverage to Add flows

Extend `AddEmployeeDrawer.tsx` and `AddTrainerDrawer.tsx` to also collect (optional) DOB, address, government_id_type/number at creation time and write them to the new profile row created by the edge functions (`create-staff-user`, `create-trainer-user`). No edge-function change needed — the client can update the profile row immediately after creation since it owns `user_id`.

### D. Quick verification after change

- Re-create a contract for the existing Bhagirath Gurjar (EMP-MOZWZUNA) and confirm the row shows name, code, base salary, commission in the Contracts table.
- Open Edit on Bhagirath, confirm DOB/address/government ID/salary/commission can all be saved from UI and persist.

### Files to touch

- `src/services/hrmService.ts` — add `branchId` to `createContract`
- `src/components/hrm/CreateContractDrawer.tsx` — pass `branchId`
- `src/pages/HRM.tsx` — rewrite `all-contracts` join
- `src/components/employees/EditEmployeeDrawer.tsx` — tabbed Personal / Employment / Biometrics + profile update
- `src/components/employees/AddEmployeeDrawer.tsx` — optional personal fields
- `src/components/trainers/EditTrainerDrawer.tsx` + `AddTrainerDrawer.tsx` — same personal fields + commission %

### Out of scope

- No DB schema changes — every needed column already exists on `profiles`, `employees`, `trainers`, `contracts`.
- No RLS changes — current `admin_access_employees` policy already allows owner/admin/manager to update.
