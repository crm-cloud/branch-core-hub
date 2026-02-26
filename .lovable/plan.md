

# Audit & Fix Plan: Device Sync, Avatar Upload, View-As Removal, Branch Manager, Demo Data, Build Errors

## Critical Issues Found

### Build Errors (Must Fix First)
1. **`reset-all-data/index.ts` line 154**: `error` is `unknown` type -- needs `(error as Error).message`
2. **HMR failures**: Console logs show Gatekeeper.tsx, PendingApproval.tsx, SelectBranch.tsx fail to reload -- these files do NOT exist in the codebase. These are phantom HMR references, likely from stale Vite module graph. No actual imports reference them -- safe to ignore (they don't break the build).
3. **error_logs RLS 401**: The ErrorBoundary fires on the `/auth` page crash ("useAuth must be used within AuthProvider"). Since the user is unauthenticated at that point, the `TO authenticated` RLS policy blocks the insert. The ErrorBoundary should gracefully handle this (it already does with try/catch, so this is expected silent failure -- not a blocker).
4. **Auth page crash**: `useAuth` is called inside `AuthPage` component which IS inside `<AuthProvider>` in App.tsx (line 118-125). The real crash is that Auth page renders before AuthProvider finishes initializing. This needs investigation but is likely a race condition in `AuthContext`.

---

## 1. Fix Build Error in `reset-all-data/index.ts`

**File:** `supabase/functions/reset-all-data/index.ts` line 154
**Fix:** Change `error.message` to `(error as Error).message`

---

## 2. Device Management -- Align with Hardware API

**Current state:** Device Management page, `deviceService.ts`, Add/Edit drawers are all functional and aligned with the `device-access-event`, `device-sync-data`, `device-heartbeat`, and `device-trigger-relay` edge functions. The service correctly handles CRUD, relay triggers, and Realtime command subscriptions.

**Issues found:**
- The "Add Device" form works but lacks a "Test Connection" button to verify the device is reachable
- No visual indication of the sync API endpoint URL that the Android app needs to call
- Missing: a small info card showing the API endpoints for device provisioning

**Fix:** Add an "API Info" collapsible card on DeviceManagement page showing the edge function URLs for device setup (heartbeat, sync, access-event endpoints) so admins can copy them when configuring Android hardware.

---

## 3. Admin Avatar Upload -- Fix Profile Page

**Current state:** The Profile page (`/profile`) displays the avatar but has NO upload button. The `AvatarUpload` component exists but is not used on the Profile page. The `avatars` storage bucket exists and is public.

**Fix:** Import and use `AvatarUpload` component (or add inline upload logic) on the Profile page, replacing the read-only Avatar display. This gives admin/staff/trainer/manager users the ability to upload their profile photo.

**File:** `src/pages/Profile.tsx` -- replace the static Avatar with the `AvatarUpload` component.

---

## 4. Staff/Trainer Avatar Sync to Biometric Queue

**Current state:** `StaffAvatarUpload` component already calls `queueStaffSync()` from `biometricService.ts` after upload. `MemberAvatarUpload` calls `queueMemberSync()`. Both are already wired correctly.

**Issue:** When staff/trainers upload avatars through the Employee drawer or Trainer drawer, it uses `StaffAvatarUpload` which handles sync. But on the **Profile page**, there is no avatar upload at all (see #3 above). When we add avatar upload to Profile page, we need to also trigger `queueStaffSync` for staff/trainer roles after upload.

**Fix:** On the Profile page, after avatar upload succeeds, check user role and call the appropriate biometric sync function.

---

## 5. Remove "View As" Feature Completely

**Current state:** ViewAsContext, ViewAs dropdown in AppHeader, sidebar role switching, banner -- all implemented.

**Fix:** Remove all View As references:
- **`src/contexts/ViewAsContext.tsx`**: Delete the file
- **`src/App.tsx`**: Remove ViewAsProvider import and wrapper
- **`src/components/layout/AppHeader.tsx`**: Remove viewAs imports, state, banner, dropdown sub-menu
- **`src/components/layout/AppSidebar.tsx`**: Remove viewAs imports and `effectiveRoles` logic, just use `roles` directly
- **`src/components/auth/DashboardRedirect.tsx`**: No changes needed (doesn't use ViewAs currently)

---

## 6. Branch Manager Assignment Audit

**Current state audit results -- the flow is CORRECT:**

1. **AddBranchDialog**: Creates branch, inserts into `branch_managers` and `staff_branches` if manager selected ✓
2. **EditBranchDrawer**: Fetches current manager, shows potential managers (owner/admin/manager roles), updates `branch_managers` on save ✓
3. **AddEmployeeDrawer**: When role is `manager`, inserts into `branch_managers` ✓
4. **BranchContext**: Fetches manager's assigned branches from `staff_branches` ✓
5. **Branches page & BranchSettings**: Both fetch and display primary managers ✓

**One minor issue found:** `staff_branches` table has `isOneToOne: true` constraint on `user_id`, meaning a manager can only be assigned to ONE branch via `staff_branches`. This conflicts with the multi-branch manager requirement.

**Fix needed:** The `staff_branches` unique constraint on `user_id` needs to be dropped to allow managers to have multiple branch assignments. This requires a database migration to alter the constraint to be a composite unique on `(user_id, branch_id)` instead of just `user_id`.

Additionally, the `AddEmployeeDrawer` only inserts one `staff_branches` row. For managers needing multiple branches, the `EditBranchDrawer` already handles adding the manager to the specific branch. The flow works but the DB constraint blocks multi-branch.

---

## 7. Demo Data Settings -- Make Selectable Categories

**Current state:** `DemoDataSettings.tsx` has a single "Load Demo Data" button that calls `seed-test-data` edge function, which creates ALL categories at once. No granular control.

**Fix:**
- Add checkboxes next to each `dataCategories` item so admin can select which categories to import
- Pass the selected categories as a `categories` array in the request body to `seed-test-data`
- Update `seed-test-data` edge function to accept an optional `categories` filter and only seed selected data types
- Improve the UI with better card layout per category showing what will be created

**Files:**
- `src/components/settings/DemoDataSettings.tsx` -- add checkbox UI
- `supabase/functions/seed-test-data/index.ts` -- accept `categories` filter param

---

## 8. Error Boundary RLS Fix

The error_logs insert fails for unauthenticated users (401). The current ErrorBoundary already wraps the insert in try/catch so it fails silently. However, we should also allow anonymous inserts for errors that happen before login.

**Fix:** Add an RLS policy allowing anonymous inserts to `error_logs` (the table has no sensitive data flowing IN, only error messages). Or better: make the ErrorBoundary skip the DB insert when there's no auth session.

**Recommendation:** Skip DB insert when no auth session exists (simpler, no RLS change needed). The ErrorBoundary already catches the failure -- just add a pre-check.

---

## Files Summary

| Action | File | Description |
|--------|------|-------------|
| Edit | `supabase/functions/reset-all-data/index.ts` | Fix `error as Error` type cast |
| Edit | `src/pages/Profile.tsx` | Add AvatarUpload component with biometric sync |
| Delete | `src/contexts/ViewAsContext.tsx` | Remove View As feature |
| Edit | `src/App.tsx` | Remove ViewAsProvider |
| Edit | `src/components/layout/AppHeader.tsx` | Remove View As dropdown/banner |
| Edit | `src/components/layout/AppSidebar.tsx` | Remove View As role switching |
| Edit | `src/components/settings/DemoDataSettings.tsx` | Add selectable category checkboxes |
| Edit | `supabase/functions/seed-test-data/index.ts` | Accept categories filter |
| Edit | `src/pages/DeviceManagement.tsx` | Add API info card for device provisioning |
| Edit | `src/components/common/ErrorBoundary.tsx` | Skip DB insert when no auth session |
| Migration | SQL | Drop `staff_branches` unique constraint on `user_id`, add composite unique on `(user_id, branch_id)` |

## Execution Order

| Step | Priority | Description |
|------|----------|-------------|
| 1 | Critical | Fix build error in reset-all-data (blocks deployment) |
| 2 | Critical | Remove View As feature completely |
| 3 | High | Add avatar upload to Profile page with biometric sync |
| 4 | High | Fix staff_branches constraint for multi-branch managers |
| 5 | High | ErrorBoundary: skip DB insert when unauthenticated |
| 6 | Medium | Make demo data selectable by category |
| 7 | Medium | Add API info card to Device Management |

