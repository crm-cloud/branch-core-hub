# Deep Audit & Fix: Manager RBAC, Employee/Trainer Forms, Branch Assignment

## Issues Found

### 1. Manager Menu — Wrong Access Restrictions

The current `managerMenuConfig` is too restrictive. Managers need:

- **Analytics** — to view branch performance (add `manager` to route + menu)
- **Finance Overview** — to manage daily branch finances (add `manager` to route + menu)
- **Payments** — to track branch payments (add `manager` to route + menu)
- **HRM** — to manage staff in their branch (add `manager` to route + menu)
- **Devices** — already present, correct but we need to remove this because this settings will be managed by admin/owner.

Items managers should NOT have:

- System Health, Audit Logs, Settings — correct, these stay admin/owner only

**Files:** `src/config/menu.ts` (update `managerMenuConfig`), `src/App.tsx` (update `requiredRoles` on `/analytics`, `/finance`, `/payments`, `/hrm` routes to include `manager`)

### 2. `create-staff-user` Edge Function — Two Critical Gaps

**Gap A: Caller authorization too restrictive.** Line 119 only allows `owner`/`admin` callers. Managers cannot create staff/members/trainers in their branch. Fix: add `manager` to the `in('role', ...)` check.

**Gap B: Missing `branch_managers` insert for manager role.** When role is `manager`, the function creates an employee record but never inserts into `branch_managers`. Fix: add `branch_managers` insert when role is `manager`.

**File:** `supabase/functions/create-staff-user/index.ts`

### 3. AddEmployeeDrawer — Missing Fields Not Synced with DB

The employee form sends `department`, `position`, `salary`, `salary_type`, `bank_name`, `bank_account`, `tax_id` to `create-staff-user`, but the edge function ignores all of them (lines 324-335 only set `employee_code`, `hire_date`, `position` hardcoded). The form fields are wasted.

**Fix:** Update `create-staff-user` to accept and pass through `department`, `salary`, `salary_type`, `bank_name`, `bank_account`, `tax_id` from the request body into the employee insert.

**File:** `supabase/functions/create-staff-user/index.ts`

### 4. EditEmployeeDrawer — Missing Branch & Role Fields

The edit form only shows department/position/salary/bank/tax/active status. It cannot change the employee's branch or role assignment, and doesn't show the current branch. For managers editing staff in their branch, this is a gap.

**Fix:** Add read-only branch display and the ability to change branch assignment (for admin/owner) in the edit form. Also invalidate more query keys after save.

**File:** `src/components/employees/EditEmployeeDrawer.tsx`

### 5. AddTrainerDrawer — Password Field is Redundant

Line 397-406 shows a password field, but `create-staff-user` generates a temp password and uses `must_set_password`. The password field is misleading and unused.

**Fix:** Remove the password field from the trainer create form.

**File:** `src/components/trainers/AddTrainerDrawer.tsx`

### 6. Staff & Trainer Menu Configs — Minor Gaps

Staff menu is appropriately limited. Trainer menu is appropriately limited. No changes needed for these.

---

## Files to Change


| File                                              | Change                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/config/menu.ts`                              | Add Analytics, Finance Overview, Payments, HRM to `managerMenuConfig`; remove Devices from manager menu (per user request)     |
| `src/App.tsx`                                     | Add `manager` to `requiredRoles` for `/analytics`, `/finance`, `/payments`, `/hrm` routes                                      |
| `supabase/functions/create-staff-user/index.ts`   | (1) Allow `manager` callers, (2) insert `branch_managers` for manager role, (3) pass through employee fields from request body |
| `src/components/employees/EditEmployeeDrawer.tsx` | Add branch display, broader query invalidation                                                                                 |
| `src/components/trainers/AddTrainerDrawer.tsx`    | Remove password field                                                                                                          |


## Execution Order

1. Update manager menu config + route permissions
2. Fix `create-staff-user` edge function (authorization + branch_managers + form fields)
3. Fix EditEmployeeDrawer (branch display + invalidation)
4. Remove password field from AddTrainerDrawer