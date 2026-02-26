
## Goal
Fix login crashes + enforce “Gatekeeper” branch/role setup before any dashboard; fix 400/406 errors; implement manager creation/assignment workflow and robust staff logins.

## A) Backend (Lovable Cloud) migrations
1. **Backfill missing profiles**
   - Insert `profiles` rows for any `auth.users` referenced by `employees.user_id`, `trainers.user_id`, or `user_roles.user_id` where `profiles.id` is missing.
2. **Add missing relationships to stop 400 joins**
   - Add FK: `employees.user_id → profiles.id` (match `members` pattern).
   - Add FK: `trainers.user_id → profiles.id`.
3. **Harden profiles creation**
   - Add RLS policy allowing authenticated users to **insert their own** `profiles` row (`id = auth.uid()`), to prevent 406 `.single()` failures in edge cases (safe guard).
4. **(Optional but recommended) Fix “one global org settings”**
   - Add a partial unique index to ensure only one row with `branch_id IS NULL` if you want a true global org config (otherwise keep as-is).

## B) Auth “Gatekeeper” flow (no branch+role → no dashboard)
1. **AuthContext hydration**
   - Add explicit flags: `rolesLoaded`, `profileLoaded` and keep `isLoading=true` until both are fetched after any login/session change.
   - Change `fetchProfile()` to `.maybeSingle()` (avoid 406), and if missing, attempt to create profile (insert) using the authenticated user’s email.
2. **Prevent OTP from creating new users**
   - Update email OTP sign-in to `shouldCreateUser: false`.
   - Do the same for phone OTP if supported; otherwise disable phone OTP UI until configured.
3. **New routes/pages**
   - Create `PendingApprovalPage` (role missing / no branch assignment / incomplete onboarding).
   - Create `BranchSelectionSplashPage` (manager with >1 assigned branch; mandatory selection every session).
   - Create `GatekeeperPage` (the post-login router that:
     - loads roles
     - resolves branch assignment based on role
     - forces branch splash for multi-branch managers
     - stores `current_branch_id` (sessionStorage) and sets BranchContext
     - routes to correct dashboard)
4. **Wire routing**
   - Change `/home` to render `GatekeeperPage` (instead of current `DashboardRedirect`).
   - Ensure Auth page redirects authenticated users to `/home` only (never directly to `/dashboard`).
5. **Fix hardcoded redirects**
   - Update `OtpLoginForm` to navigate to `/home` (not `/dashboard`).
   - Update `SetPasswordForm` to navigate to `/home` (not `/dashboard`).

## C) BranchContext “compression audit” (remove `branch_id=all` mistakes)
1. **Stop using `'all'` as a real branch id**
   - For non-owner/admin roles, never keep `selectedBranch='all'` once authenticated.
   - Introduce `branchReady`/`initialized` output and make queries depend on `effectiveBranchId` instead of `selectedBranch`.
2. **Persist manager branch choice**
   - Read/write last selected manager branch (`sessionStorage.current_branch_id`) and apply after Gatekeeper selection.
3. **Update all settings/data queries that use `selectedBranch` directly**
   - Replace `eq('branch_id', selectedBranch)` with:
     - `effectiveBranchId` for branch-scoped data
     - or “global row” logic (`branch_id IS NULL`) for org-wide settings.

## D) Fix the specific 400/406 issues you reported
1. **400 on `organization_settings?branch_id=eq.all`**
   - Update `OrganizationSettings` to use `effectiveBranchId` (and only filter when it’s a real UUID).
   - Update save logic to **upsert** by `branch_id` (prevents 409 conflicts).
2. **400 on contracts join in HRM**
   - After adding `employees.user_id → profiles.id` FK, update HRM contracts query to use `profiles:user_id(...)` properly (or do a 2-query merge if preferred).
3. **406 on profile lookup**
   - Fixed by: profile backfill + AuthContext `.maybeSingle()` + auto-insert own profile policy.

## E) Manager workflow (creation → branch assignment → login → branch selector)
1. **User provisioning**
   - Ensure `/admin/users` route points to `AdminUsersPage` (remove redirect to `settings?tab=users` unless that tab actually exists).
   - Update `create-staff-user` backend function:
     - use `profiles.upsert(...)` (not `update`) so profile always exists
     - when role = `manager`, also `upsert` into `branch_managers` with `is_primary=true` for the primary branch.
2. **On login**
   - Gatekeeper resolves manager branches via `staff_branches`.
   - If multiple: show Branch Selection Splash (mandatory).
   - After selection: branch selector appears in header (manager can switch).

## F) Unified workforce drawer (Edit Employee → primary branch + roles + manager assigned branches)
1. **Extend `EditEmployeeDrawer`**
   - Add “Primary Branch” dropdown → updates `employees.branch_id`.
   - Add “Role” selector (radio group): Staff / Manager (and optionally Trainer if you want to unify further).
   - If Manager selected:
     - Show “Assigned Branches” multi-select checklist (writes to `staff_branches` as many rows).
     - Show “Primary Manager Branch” (writes to `branch_managers` for that branch, admin-only).
2. **Constraints**
   - Enforce: Staff/Trainer = exactly one branch; Manager = one-or-many.
   - UI + backend validation in save handler.

## Files to change / add
- Edit: `src/contexts/AuthContext.tsx`
- Edit: `src/pages/Auth.tsx`
- Edit: `src/components/auth/OtpLoginForm.tsx`
- Edit: `src/components/auth/SetPasswordForm.tsx`
- Edit: `src/contexts/BranchContext.tsx`
- Edit: `src/components/settings/OrganizationSettings.tsx`
- Edit: `src/pages/HRM.tsx`
- Edit: `src/App.tsx` (route wiring for `/home`, `/pending-approval`, `/select-branch`, `/admin/users`)
- Edit: `supabase/functions/create-staff-user/index.ts`
- Edit: `supabase/functions/create-member-user/index.ts` (profiles upsert)
- Add: `src/pages/PendingApproval.tsx`
- Add: `src/pages/SelectBranch.tsx` (manager splash)
- Add: `src/pages/Gatekeeper.tsx` (central post-login resolver)
- Edit: `src/components/employees/EditEmployeeDrawer.tsx`
- Migration: `supabase/migrations/*_gatekeeper_profiles_fk.sql`

## Verification checklist (after implementation)
1. Create a Staff user → login → must land on Staff Dashboard (no branch splash), no 400/406.
2. Create a Manager user with 2 branches → login → must see branch splash → then Dashboard.
3. Visit Settings → Organization tab as staff/manager → no `branch_id=all` requests.
4. HRM page → contracts load without 400.
5. If a legacy user exists without a profile row → login should auto-repair and proceed (or show Pending Approval if role/branch missing).
