

# Comprehensive Fix Plan: 45 DB Errors, Staff Login, Themes, Branch Switcher

## 1. Staff Dashboard Login Issue

**Root cause:** The user `harish.lekhari@alvstore.in` has role `staff`, an employee record, and `must_set_password: false`. The login flow should work (Auth → `/home` → `DashboardRedirect` → `/staff-dashboard`). The issue is likely that `DashboardRedirect` checks `roles.some(r => r.role === 'staff')` but ALSO checks that the user does NOT have `owner/admin/manager` — if the role fetch is slow or fails silently, the user may see a blank state.

**Fix:** Add a loading fallback and verify the staff branch query doesn't fail silently. Also ensure the `create-staff-user` edge function creates the employee record for ALL staff roles (currently it only does so for `staff` and `manager`, not `trainer` — trainers get a trainer record but NOT an employee record, meaning `StaffDashboard` can't find their `employees` record).

**Gap between staff/trainer creation:** The `create-staff-user` function creates an `employees` record only for `staff`/`manager` roles, and a `trainers` record only for `trainer` role. But the `StaffDashboard` queries the `employees` table for branch info — so trainers cannot access staff dashboard. This is by design (trainers go to `/trainer-dashboard`), but a trainer with NO trainer record in DB would get stuck.

**Fix:** No code change needed for the login path. The `DashboardRedirect` already handles trainers → `/trainer-dashboard`. The actual fix is to ensure the edge function is called correctly from the UI and that all form fields (department, position, salary_type) are passed through. Check the `AddEmployeeDrawer` submission to ensure enum values are sent to the edge function.

## 2. System Health — Fix All 45 Errors (6 Unique Categories)

### Error Category A: `trainers.user_id` FK missing to `profiles` (6 errors)
**Cause:** `trainers.user_id` has FK to `auth.users` only, not `profiles`. Queries like `trainers(user_id, profiles:user_id(full_name))` fail.
**DB Fix:** Add FK `trainers_user_id_profiles_fkey` from `trainers.user_id` to `profiles.id`.

### Error Category B: `employees.user_id` ambiguous FK (6 errors)  
**Cause:** We already added `employees_user_id_profiles_fkey` in previous migration. Now there are TWO FKs on `user_id` → PostgREST can't resolve `profiles:user_id(full_name)` without specifying the FK name.
**Code Fix:** Use explicit FK hint in HRM query: `profiles:employees_user_id_profiles_fkey(full_name)`.

### Error Category C: `pt_sessions` → `members` no relationship (6 errors on `/all-bookings`, `/trainer-dashboard`)
**Cause:** `pt_sessions` has no `member_id` column. The path is `pt_sessions → member_pt_packages → members`. The query `member:members(...)` is invalid.
**Code Fix:** Change the `AllBookings.tsx` PT sessions query to join through `member_pt_packages`:
```
pt_sessions → member_pt_package:member_pt_packages(member:members(id, member_code, user_id))
```

### Error Category D: `pos_sales` ↔ `invoices` ambiguous (7 errors on `/store`, `/pos`)
**Cause:** `pos_sales.invoice_id → invoices(id)` AND `invoices.pos_sale_id → pos_sales(id)` — bidirectional FKs cause PostgREST ambiguity.
**Code Fix:** Use explicit FK hint: `invoices!pos_sales_invoice_id_fkey(invoice_number)` in Store.tsx and POS.tsx.

### Error Category E: `membership_plans.duration_months` does not exist (6 errors on `/`)
**Cause:** Column is `duration_days`, not `duration_months`. Used in `PublicWebsite.tsx`.
**Code Fix:** Change to `duration_days` and compute months: `Math.round(p.duration_days / 30)`.

### Error Category F: `members.is_active` does not exist (1 error on `/referrals`)
**Cause:** `members` table uses `status` column, not `is_active`. Used in `Referrals.tsx`.
**Code Fix:** Change `.eq('is_active', true)` to `.eq('status', 'active')`.

### Error Category G: `DialogTitle` missing (10+ errors across 8+ routes)
**Cause:** Multiple `Sheet`/`Dialog` components missing `DialogTitle` for accessibility.
**Code Fix:** Add hidden `DialogTitle` or `SheetTitle` to all offending drawers. This is a widespread issue — audit all Sheet/Dialog usages.

### Error Category H: `members_1.full_name` does not exist (1 error on `/analytics`)
**Cause:** Already identified in previous plan — `members` has no `full_name`, must join `profiles`.
**Code Fix:** Already fixed in Analytics.tsx in prior iteration. Verify.

## 3. Theme System with Switchable Themes & Rounded UI

**Reference:** User shared a green-themed dashboard (Donezo) with rounded cards, rounded icons, and modern cards.

**Implementation:**
- Create a `ThemeProvider` context that supports multiple color themes (Default Indigo, Emerald Green, Amber, Rose, Slate).
- Each theme defines CSS custom properties for `--primary`, `--accent`, `--card-radius`, etc.
- Add a theme picker in Settings → User Settings.
- Update `index.css` to use CSS custom properties for colors.
- Apply `rounded-2xl` consistently to all cards and `rounded-full` to all icon badges (already partially done per Vuexy guidelines).

## 4. Branch Switcher Not Working Smoothly on Lockers Page

**Root cause:** The Lockers page uses `effectiveBranchId` from `BranchContext`. When the branch changes, `effectiveBranchId` updates → `useLockers(branchId)` re-fetches → the query key `['lockers', branchId]` changes → data refetches. This should work.

**Actual issue:** When `selectedBranch` changes to `'all'`, `effectiveBranchId` falls back to `branches[0]?.id`. If `branches` is still loading, it returns `undefined` → `useLockers(undefined)` → `enabled: !!branchId` is `false` → no data.

**Fix:** Add a loading state check. When `BranchContext.isLoading` is true, show a skeleton. Also ensure `effectiveBranchId` always resolves to a valid branch before enabling queries.

## 5. Staff Creation Enum Not Saving

**Root cause:** The `AddEmployeeDrawer`'s "Create New" tab calls `supabase.functions.invoke('create-staff-user', { body: { ... } })`. The body sends `salary_type`, `department`, `position` etc. But the edge function extracts these fields AFTER the user creation section (line 322-329) and only uses them when `role === 'staff' || role === 'manager'`. If the form sends `role: 'staff'` but the department/position/salary_type values are empty strings, `sanitizeString` returns `''` which gets passed as empty strings to the insert, not `null`. The DB stores empty strings, which appear blank in the UI.

**Fix:** Update the edge function to convert empty strings to `null` for optional fields: `department: department || null`, `position: position || null`. (Already done on line 343-344 for department but salary_type on line 345 uses `empSalaryType || 'monthly'` which falls back correctly. Verify the form actually sends these fields.)

Also check the `AddEmployeeDrawer` "Create New" tab form — ensure it includes `salary_type`, `department`, `position` in the body sent to the edge function.

---

## Database Migration Required

```sql
-- Fix: trainers.user_id FK to profiles for PostgREST joins
ALTER TABLE public.trainers
  ADD CONSTRAINT trainers_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
```

## Files to Change

| File | Change |
|------|--------|
| **DB Migration** | Add `trainers_user_id_profiles_fkey` FK |
| `src/pages/HRM.tsx` | Fix contracts query with explicit FK hint |
| `src/pages/AllBookings.tsx` | Fix PT sessions query (join through `member_pt_packages`) |
| `src/pages/Store.tsx` | Fix `pos_sales` → `invoices` with explicit FK hint |
| `src/pages/POS.tsx` | Fix `pos_sales` → `invoices` with explicit FK hint |
| `src/pages/PublicWebsite.tsx` | Change `duration_months` to `duration_days` |
| `src/pages/Referrals.tsx` | Change `members.is_active` to `members.status = 'active'` |
| `src/pages/TrainerEarnings.tsx` | Fix PT sessions query (join through `member_pt_packages`) |
| `src/pages/Lockers.tsx` | Add loading state for branch context |
| `src/index.css` | Add CSS custom properties for theme system |
| `src/contexts/ThemeContext.tsx` | **NEW** — Theme provider with switchable themes |
| `src/components/settings/ThemePicker.tsx` | **NEW** — Theme selection UI in Settings |
| `src/main.tsx` | Wrap app with ThemeProvider |
| `src/components/employees/AddEmployeeDrawer.tsx` | Verify form fields sent to edge function |
| Multiple Sheet/Dialog files | Add missing `DialogTitle`/`SheetTitle` for accessibility |

## Execution Order
1. DB migration (trainers FK to profiles)
2. Fix all 6 query error categories (HRM, AllBookings, Store, POS, PublicWebsite, Referrals, TrainerEarnings)
3. Fix DialogTitle accessibility warnings across all routes
4. Add branch switcher loading state for Lockers
5. Implement theme system (ThemeContext + ThemePicker + CSS variables)
6. Verify staff creation form field passthrough

