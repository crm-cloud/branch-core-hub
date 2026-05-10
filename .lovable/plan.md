# Unified Staff Profile — fix blank Edit Employee drawer

## Root cause (audited)

Bhagirath's data is **already saved correctly** in `profiles` (gender=male, dob=1992-06-20, city=UDAIPUR, state=Rajasthan, postal=313001, phone=+917014492634). Verified with a direct DB query.

The fields are blank in the **Edit Employee** drawer because the queries that feed it only `SELECT` a tiny subset of profile columns:

- `src/services/hrmService.ts → fetchEmployees()` (line 57): selects only `id, full_name, email, phone, avatar_url, date_of_birth` — missing gender, address, city, state, postal_code, emergency_*, government_id_*.
- `src/services/hrmService.ts → getEmployee()` (line 81): same — missing postal_code, emergency_*, government_id_*.
- `src/pages/Employees.tsx → all-staff query` (line 75): selects only `id, full_name, email, phone, avatar_url`.

`EditEmployeeDrawer` then reads `employee.profile?.gender`, `…?.city`, etc. → `undefined` → blank inputs. (`EditTrainerDrawer` was already fixed in the previous round, which is why **trainer** edit shows the data but **employee** edit does not.)

## How "sync across app" already works (and where to make it visible)

Personal details (name, phone, gender, dob, address, gov ID, emergency contact, avatar) live in **one row per user** in `profiles`. Both `employees.user_id` and `trainers.user_id` point to the same `profiles.id`. So a dual-role person like Bhagirath has **one** personal record — there is no duplication in the DB. The duplication exists only in the UI because each drawer queries profile fields independently.

Once the SELECT lists are widened, editing in either Edit Employee or Edit Trainer writes to the same `profiles` row → instantly visible in the other drawer, in HRM, in Trainers, in Contracts, and in the Member directory.

No database migration, no backfill needed — Bhagirath's data already exists; we just have to read it.

## Plan

### 1. Widen profile SELECTs (fixes the blank fields)
- `src/services/hrmService.ts`
  - `fetchEmployees()` profiles select → add `gender, address, city, state, postal_code, emergency_contact_name, emergency_contact_phone, government_id_type, government_id_number`.
  - `getEmployee()` profiles select → same additions.
- `src/pages/Employees.tsx`
  - `all-staff` query profiles select → same additions.
  - Map all fields onto `UnifiedStaff.profile` so `openContractDrawer` and edit handoffs carry the full profile, not just `{ full_name, email, phone }`.

### 2. Make the "shared profile" obvious in the UI
- In **EditEmployeeDrawer** and **EditTrainerDrawer**, add a single info strip at the top of the Personal tab:  
  *"Personal details are shared across Employee, Trainer, HRM and Contracts. Editing here updates the master profile."*  
  When the user has both roles (detected by checking `employees` + `trainers` for the same `user_id`), show a second line: *"Linked: also a Trainer (or Employee). Changes apply to both."*
- Keep the existing green **Linked** badge in the All Staff table; mirror it in the HRM Employees and Trainers tabs so dual-role staff are immediately recognizable.

### 3. Edit handoff parity
- In **HRM.tsx**, when opening Edit Employee/Trainer, pass the row that already includes the wide `profile` from `fetchEmployees()` / `fetchTrainers()` (already wide for trainers).
- In **Employees.tsx**, wire an Edit action on the row (currently only Contract + toggle exist) so the user has the same edit entry from both pages. Open `EditEmployeeDrawer` for employee rows and `EditTrainerDrawer` for trainer rows, using the now-complete `profile` payload.

### 4. No DB changes
- No migration. No backfill (data is intact).
- No payroll math change (dual-role dedupe already correct from prior round).

## Files to touch
- `src/services/hrmService.ts` — widen 2 SELECT lists
- `src/pages/Employees.tsx` — widen 1 SELECT, extend `UnifiedStaff.profile`, add Edit action, Linked badges
- `src/pages/HRM.tsx` — Linked badges in Employees/Trainers tabs
- `src/components/employees/EditEmployeeDrawer.tsx` — info strip + dual-role line
- `src/components/trainers/EditTrainerDrawer.tsx` — info strip + dual-role line

## Verification
- Open Edit Employee on Bhagirath → Phone `+917014492634`, Gender `Male`, DOB `1992-06-20`, City `UDAIPUR`, State `Rajasthan`, Postal `313001` all pre-filled.
- Change DOB in Edit Trainer → reopen Edit Employee → new DOB visible (single profile row).
- All Staff list shows Linked badge on both Bhagirath rows.
