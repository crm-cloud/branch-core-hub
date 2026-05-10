## Audit findings

### Bug 1 — `column trainers_1.commission_percentage does not exist`
Recorded in `error_logs` (route `/hrm`, last seen 2026-05-10 16:00, count 3).

Root cause: `src/pages/HRM.tsx` line 116 selects `commission_percentage` from the **trainers** table, but that column lives on the **contracts** table.

Verified DB schema:
- `trainers` columns: salary_type, fixed_salary, **pt_share_percentage**, hourly_rate (no `commission_percentage`)
- `contracts` columns: salary, base_salary, **commission_percentage** ✓

The `_1` alias in the error is PostgREST's way of disambiguating the embedded join.

### Bug 2 — Bhagirath Gurjar (`bhagirathbhau@gmail.com`)
Current state in DB:
- `profiles`: full record OK
- `user_roles`: only `manager`
- `employees`: row exists (EMP-MOZWZUNA, Branch Manager, Management dept, ₹25,000)
- `trainers`: **no row** — that's why no commission can be tracked

You do **NOT** need a second email. One auth user can hold multiple roles and exist in both `employees` and `trainers` tables simultaneously. The schema supports it.

### Dashboard routing for dual-role users
`src/lib/roleRedirect.ts` rule today:
- Has `member` → `/member-dashboard`
- Has `trainer` AND no admin role → `/trainer-dashboard`
- Has `staff` AND no admin role → `/staff-dashboard`
- Has `owner|admin|manager` → `/dashboard`

So once Bhagirath has both `manager` + `trainer`, he lands on the main `/dashboard` (correct — manager wins). His trainer commissions are still tracked because:
- `trainer_commissions` rows are created per PT session against his `trainers.id`
- He can view them from **Trainers → his profile** and **HRM → Payroll** (PT Commission column)
- A "Trainer Earnings" link can be exposed in the sidebar for managers who are also trainers

## Plan

### Step 1 — Fix the SQL error (frontend only)
File: `src/pages/HRM.tsx` (line 116)
- Remove `commission_percentage` from the embedded `trainers!...` select.
- The contract row already returns `commission_percentage` from its own columns (used at line 583), so display is unaffected.

```diff
- trainers!contracts_trainer_id_fkey(id, user_id, specializations, commission_percentage)
+ trainers!contracts_trainer_id_fkey(id, user_id, specializations, pt_share_percentage)
```

(Keep `pt_share_percentage` in case any UI wants the trainer-level default; HRM table reads `contract.commission_percentage` directly.)

### Step 2 — Promote Bhagirath to trainer (data-only)
Run via the insert tool (no migration, no schema change):

1. Insert a row into `public.trainers` with `user_id = 57173ed8-6ee7-46b3-a6bc-da4fc4278fb0`, branch `11111111-1111-1111-1111-111111111111`, `salary_type='hybrid'`, `fixed_salary=25000`, `pt_share_percentage=10`, `is_active=true`, default `max_clients=10`.
2. Insert into `public.user_roles` `(user_id, role) = (57173ed8…, 'trainer')` (manager role stays).

After that:
- He logs in with the same email/password and lands on `/dashboard` (manager view).
- He appears in **Trainers** list and can be assigned to PT packages → commissions accrue in `trainer_commissions`.
- Run **HRM → Create Contract → Trainer** for him to set the commission % per contract (e.g. 10%) so payroll picks it up.

### Step 3 — Optional UX improvement (only if approved)
Add a "Switch to Trainer view" item in the sidebar/profile menu when the current user has both an admin role and a `trainers` row, deep-linking to `/trainer-dashboard` and `/trainer-earnings`. Not required to fix the bug; mention only.

### Files touched
- `src/pages/HRM.tsx` — one-line select fix.
- DB data inserts for Bhagirath (no schema changes).

### Out of scope
- No migration needed. The `trainers` table stays as-is.
- `EditTrainerDrawer` / `Edit contract` already handle `commission_percentage` correctly (it's read from `contracts`, not `trainers`).

## Answers to your questions
1. **Shall I create a new email as trainer?** No. Same email, add `trainer` role + `trainers` row.
2. **Which dashboard opens?** `/dashboard` (manager wins over trainer in the redirect rules). Trainer commissions are still calculated against his `trainers.id` and visible in Trainers and HRM Payroll. Optionally add a "Trainer view" shortcut in the sidebar.
3. **Commission setup:** After Step 2, open **HRM → Create Contract**, pick "Trainer", select Bhagirath, set base + commission %.