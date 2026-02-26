

# Fix: Login Flow Race Conditions, Role Priority, and Data Reset

## Root Cause Analysis

**Why all roles see "Account Pending":**

1. **AuthContext double-hydration race**: Both `getSession()` and `onAuthStateChange()` fire on page load, each calling `hydrateUser()`. If the auth listener fires first with the session, it defers via `setTimeout`. Then `getSession` starts its own hydration. When one finishes and sets `isLoading=false`, the Gatekeeper evaluates - but roles may be from a stale/incomplete hydration cycle.

2. **BranchContext `isLoading` is incomplete** (line 140): `const isLoading = branchesLoading` only tracks the all-branches query. For staff/trainer/member, role-specific branch queries (`staffBranch`, `memberBranch`, `managerBranches`) are NOT included. The Gatekeeper sees `isLoading=false` + `branches=[]` (fallback hasn't resolved) → redirects to `/pending-approval`.

3. **Gatekeeper role priority is wrong** (line 41): `isMember` is checked BEFORE `isOwnerOrAdmin`. If an admin also has a member role, they go to member-dashboard instead of admin dashboard. Kavita Iyer has both `member`, `manager`, and `staff` roles - she'd be routed to member-dashboard.

## Implementation Steps

### 1. Fix AuthContext - Prevent Double Hydration
**File: `src/contexts/AuthContext.tsx`**

- Add a `hydrationRef` (useRef) flag to prevent concurrent `hydrateUser` calls
- In the `useEffect`, set up `onAuthStateChange` but DON'T call `hydrateUser` inside it if `getSession` already started hydration
- Only hydrate once per session change, not twice
- Remove the `setTimeout` wrapper (it was meant to avoid deadlock but causes the race)

### 2. Fix BranchContext - Track All Loading States  
**File: `src/contexts/BranchContext.tsx`**

- Change `isLoading` to include role-specific query loading states:
  ```
  const isLoading = branchesLoading || 
    (isManager && !isOwnerOrAdmin && managerBranchesLoading) ||
    (hasAnyRole(['staff','trainer']) && !isOwnerOrAdmin && !isManager && staffBranchLoading) ||
    (hasAnyRole(['member']) && memberBranchLoading);
  ```
- Extract `isLoading` from each `useQuery` return value

### 3. Fix Gatekeeper - Correct Role Priority
**File: `src/pages/Gatekeeper.tsx`**

- Reorder: check `isOwnerOrAdmin` FIRST, then manager, then staff, then trainer, then member
- This prevents multi-role users from being misrouted

### 4. Update Reset Edge Function
**File: `supabase/functions/reset-all-data/index.ts`**

- Add `device_commands`, `error_logs`, `facilities`, `organization_settings`, `cms_pages` to the tables list
- Fix the fallback: use service-role client which bypasses RLS (it already does, but ensure the delete loop works by catching per-table errors)
- Add `full_reset` option to also delete test auth users via `supabase.auth.admin.deleteUser()`

### 5. Update Seed Edge Function  
**File: `supabase/functions/seed-test-data/index.ts`**

- Add `staff_branches` entries for trainers (currently only employees get them, but `BranchContext` queries `staff_branches` for trainer branch resolution too - or add trainers to `employees` table as well)
- Actually the BranchContext uses `trainers.branch_id` for trainer branch, so trainers are fine. But staff_branches should include trainers for consistency with the Gatekeeper flow
- Ensure seed creates `organization_settings` row for the branch
- Add `facilities` records linked to benefit_types for slot generation

### 6. Database Migration
- Add `staff_branches` entries for trainers via seed (no schema change needed)
- Ensure `organization_settings` has at least a global row

## Files to Change

| File | Change |
|------|--------|
| `src/contexts/AuthContext.tsx` | Fix race: single hydration per session, ref guard |
| `src/contexts/BranchContext.tsx` | Include role-specific query loading in `isLoading` |
| `src/pages/Gatekeeper.tsx` | Reorder: owner/admin first, member last |
| `supabase/functions/reset-all-data/index.ts` | Add missing tables, fix fallback delete |
| `supabase/functions/seed-test-data/index.ts` | Add trainer staff_branches, org_settings, facilities |

