# Unified People-Centric Staff Model

## The problem (audited)

Same person, two records, two different counts:

| Page | "Total Staff" for Bhagirath | Why |
|---|---|---|
| **HRM → Employees** | 1 (`1 Staff · 0 Trainers`) | `fetchAllPayrollStaff()` dedupes by `user_id`, drops trainer row when employee row exists. Counts only the employee side → `0 Trainers`. |
| **All Staff (`/employees`)** | 2 (`Trainers 1 · Employees 1 · Active 2`) | `all-staff` query simply concatenates `employees + trainers` rows. No dedupe. |

Both are "correct" under different mental models, but the UI presents them as the same metric, so the numbers fight each other. Bhagirath also appears as **two rows with a "Linked" badge**, which is itself a workaround for the duplication.

There are also **two separate Edit drawers** (Edit Employee, Edit Trainer) for one human, and contracts must be opened from the right row — easy to mis-attribute.

## Senior-dev fix — one canonical "Person", many "Roles"

Treat the human as the primary entity. `employees` and `trainers` rows become **role records** attached to the same person (keyed by `user_id`). The UI, stats, contracts, payroll and edit flows all pivot on the person.

### 1. Single unified list (frontend reshape, no schema change)

Build a `StaffPerson` aggregator (one per `user_id`, fallback to record id when `user_id` is null):

```ts
type StaffPerson = {
  user_id: string | null;
  profile: Profile;                 // shared personal data
  roles: Array<'manager' | 'staff' | 'trainer'>;
  employee?: EmployeeRow;           // base salary + position + branch
  trainer?: TrainerRow;             // commission % + specializations
  branches: Set<string>;            // a person can hold roles in >1 branch
  is_active: boolean;               // OR of underlying rows
};
```

Use this aggregator on **both** `/employees` (All Staff) and `/hrm` (Employees tab). Single source of truth, identical numbers everywhere.

### 2. Stats become unambiguous

Replace the current 4 ambiguous tiles with role-disaggregated tiles:

```
People        Managers   Trainers   Other Staff   Active Contracts   Monthly Payroll
   1             1          1            0               0                ₹25,000
```

- **People** = `distinct user_id` (Bhagirath = 1).
- **Managers / Trainers / Other Staff** = role counts (Bhagirath contributes to two: 1 Manager + 1 Trainer). Sum of role counts may exceed People — that's expected and labeled as such (`1 person, 2 roles`).
- **Monthly Payroll** = single base salary per person (employee row wins) + PT commissions on top. Already implemented in `fetchAllPayrollStaff`'s dedupe; we just expose the math in a tooltip.

### 3. One row per person, with Role chips

```
Staff Member          Roles                       Code           Branch    Status   Actions
Bhagirath Gurjar      [Manager] [Trainer]         EMP-MOZWZUNA   INCLINE   Active   Edit · Contracts ▾ · Payroll
bhagirathbhau@…       Strength Training, …
```

- "Roles" cell shows colored chips per role (Manager indigo, Trainer purple, Staff blue). No more "Linked" badge — duplication is gone.
- Specialization moves under the Trainer chip on hover/expanded.
- Code shows employee_code; trainer-only people show `TR-…`.

### 4. Actions split by role (clean handoff to the right drawer)

- **Edit ▾** — if the person has 2 roles, dropdown:
  - Edit Personal & Manager Role → `EditEmployeeDrawer`
  - Edit Trainer Role → `EditTrainerDrawer`  
  Single role → button opens the relevant drawer directly.
- **Contracts ▾** — list existing contracts grouped by role, plus `+ New contract for Manager` and `+ New contract for Trainer` items. The new-contract action pre-selects the role in `CreateContractDrawer`, removing the current FK-violation footgun and the manual "is this for trainer or employee?" guess.
- **Payroll** — opens person's payslip preview for the active month (already exists, just unified entry point).

### 5. Contracts page mirrors the same model

`HRM → Contracts` tab gets a "Role" column (Manager · Trainer) so the dual-role person's two contracts are visually distinct. No schema change — `contracts.employee_id` vs `contracts.trainer_id` already encodes role.

### 6. Personal data already shared (just confirmed)

`profiles` is the single source of truth for name/phone/dob/address/gov-ID/emergency. Editing in either drawer updates the same row → reflected everywhere instantly. The previous round wired Edit drawers correctly; this plan only changes how the list/stats present them.

### 7. Optional DB convenience (non-blocking)

Add a SQL view `public.staff_unified` that pre-joins `profiles`, `employees`, `trainers` and emits `roles[]`. Useful for reports & later RLS, but not required for this UI change. Skip in this round unless the user asks.

## Files to touch

- `src/services/hrmService.ts` — new `fetchUnifiedPeople(branchId?)` returning `StaffPerson[]`. Refactor `fetchAllPayrollStaff` to derive from it (keeps payroll math intact).
- `src/pages/Employees.tsx` — switch `all-staff` to `fetchUnifiedPeople`, render one row per person with Role chips, split Edit & Contracts dropdowns, drop `Linked` badge, recompute stats from people.
- `src/pages/HRM.tsx` — replace stats block + Employees tab table with the same component used on `/employees`. Removes the divergence.
- `src/components/hrm/CreateContractDrawer.tsx` — accept an optional `defaultRole: 'manager' | 'trainer'` prop and lock the role when set; show a small badge "Contract for: Trainer".
- `src/components/employees/EditEmployeeDrawer.tsx` & `src/components/trainers/EditTrainerDrawer.tsx` — both already show the "shared profile" notice; add a quick-link button "Open Trainer role" / "Open Manager role" when the person has both roles.
- New: `src/components/staff/UnifiedStaffTable.tsx` — extracted shared component used by both pages.

## Verification

1. `/employees` shows **1 row** for Bhagirath with `[Manager]` `[Trainer]` chips. Stat tiles: `People 1 · Managers 1 · Trainers 1 · Active 1`.
2. HRM stat tiles read identically.
3. `Edit ▾` shows two items; each opens the correct drawer with profile pre-filled.
4. `Contracts ▾ → + New for Trainer` opens contract drawer locked to trainer; saving inserts with `trainer_id` only (no FK error). Same for Manager.
5. Adding a second person with only a trainer role → list shows 2 People · 1 Manager · 2 Trainers.
6. Payroll math unchanged (single base salary + commissions); a tooltip on Monthly Payroll explains the dedupe rule.

## Out of scope

- No DB migration in this round.
- No payroll formula change.
- Existing biometrics & MIPS sync paths unchanged.
