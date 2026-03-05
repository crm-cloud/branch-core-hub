

# Fix Plan: Staff Login Loop, System Health Errors, Query Bugs

## Critical Issue: Staff Login Infinite Redirect Loop

**Root Cause identified definitively:** Two bugs create a redirect loop for staff users.

**Bug 1 — `Auth.tsx` line 50-58:** `getRedirectPath()` has no staff case. Staff users fall through to `return '/dashboard'`.

**Bug 2 — `ProtectedRoute.tsx` line 49-55:** When staff tries to access `/dashboard` (requires `['owner','admin','manager']`), the fallback for `roles.some(r => ['owner','admin','manager','staff'].includes(r.role))` redirects BACK to `/dashboard`. This creates an infinite loop: `/dashboard` → no access → redirect to `/dashboard` → no access → ...

**Fixes:**
- `Auth.tsx`: Add staff check in `getRedirectPath()` before the default return
- `ProtectedRoute.tsx`: Change the staff/admin fallback to check for staff specifically and redirect to `/staff-dashboard`

## System Health Errors — All 10 Unique Categories

| # | Error | Count | File | Fix |
|---|-------|-------|------|-----|
| 1 | `trainers`/`user_id` relationship ambiguous | 7 | `PublicWebsite.tsx` line 90 | Use explicit FK: `profiles:trainers_user_id_profiles_fkey(full_name, avatar_url)` |
| 2 | `membership_plans.features` does not exist | 4+7 | `PublicWebsite.tsx` line 110 | Remove `features` from select (column doesn't exist), use CMS `pricingPlans` features instead |
| 3 | `employees`/`user_id` relationship ambiguous | 6 | Already fixed in HRM; check other usages | Audit remaining usages |
| 4 | `pt_sessions`/`members` no relationship | 5+1 | `AllBookings.tsx` line 135 | Already uses `member_pt_packages` join correctly |
| 5 | `pt_sessions.session_date` does not exist | 3+1 | `AllBookings.tsx` lines 137, 208 | Column is `scheduled_at`, not `session_date` |
| 6 | `pos_sales`/`invoices` ambiguous | 4+3 | `Store.tsx`, `POS.tsx` | Already fixed with explicit FK hint; verify |
| 7 | `organization_settings` branch_id=`all` | 7 | `OrganizationSettings.tsx` line 22 | Guard: if `selectedBranch === 'all'`, don't filter by branch_id |
| 8 | `user_roles`/`user_id` relationship | 1 | Some component queries `user_roles?select=...,profiles:user_id(...)` | `user_roles.user_id` FK points to `auth.users` not `profiles`. Need DB migration or 2-step fetch |
| 9 | `members_1.full_name` does not exist | 1 | `Analytics.tsx` line 183 | Already fixed in previous iteration; verify |
| 10 | `DialogTitle` missing | 8+ routes | Multiple Sheet/Dialog components | Add hidden `SheetTitle`/`DialogTitle` to all drawers |

## Database Migration

```sql
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
```
This enables `user_roles` → `profiles` PostgREST joins.

## Files to Change

| File | Change |
|------|--------|
| `src/pages/Auth.tsx` | Add staff role check in `getRedirectPath()` |
| `src/components/auth/ProtectedRoute.tsx` | Fix staff fallback: redirect to `/staff-dashboard` not `/dashboard` |
| `src/pages/PublicWebsite.tsx` | Fix trainers query with explicit FK hint; remove `features` and `is_popular` from plans query |
| `src/pages/AllBookings.tsx` | Change `session_date` to `scheduled_at` (3 occurrences) |
| `src/components/settings/OrganizationSettings.tsx` | Guard `selectedBranch === 'all'` — don't filter by branch_id |
| **DB Migration** | Add `user_roles_user_id_profiles_fkey` FK |

## Execution Order
1. Fix staff login redirect loop (Auth.tsx + ProtectedRoute.tsx) — **critical blocker**
2. DB migration (user_roles FK to profiles)
3. Fix all query bugs (PublicWebsite, AllBookings, OrganizationSettings)
4. Add missing DialogTitle/SheetTitle for accessibility warnings

