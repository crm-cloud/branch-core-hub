

# Fix Plan: Device Management, Avatar Upload, Staff Sync, and View As/User Creation

## Issue Analysis

### 1. Device Management -- API Alignment Issues
The Device Management page and edge functions are already well-aligned with the API spec. The `device-access-event` endpoint handles face recognition, Wiegand fallback, membership validation, and custom messages. The `device-sync-data` endpoint supports both incremental and full roster modes. The `device-trigger-relay` and `device_commands` Realtime approach for remote open are both implemented.

**Actual issues found:**
- The `addDevice` function in `deviceService.ts` casts `ip_address` as `unknown` (line 89) which is a workaround for a type mismatch -- the database likely stores `inet` type but the TypeScript types may not reflect it. This needs cleanup.
- The Add Device drawer and Edit Device drawer reference fields like `firmware_version` but there's no input for it in the form -- it's expected to come from the device heartbeat, which is correct.
- The Device Management page is functionally sound. No major misalignment with the APIs. Minor UI polish needed: add Serial Number (SN) column to the table since that's the primary identifier for SMDT hardware, and show `last_sync` alongside `last_heartbeat`.

### 2. Admin Avatar Upload -- Missing from Profile Page
The Profile page (`src/pages/Profile.tsx`) shows the avatar but has **no upload button**. The `AvatarUpload` component (`src/components/auth/AvatarUpload.tsx`) exists and works perfectly -- it uploads to the `avatars` bucket and updates the profile. It just needs to be integrated into the Profile page, replacing the static `Avatar` display.

### 3. Staff Photo Sync -- Like Members
Members already have biometric photo sync via `HardwareBiometricsTab.tsx` which calls `queueMemberSync()`. Staff already have avatar upload in `EditEmployeeDrawer.tsx` which calls `queueStaffSync()`. The `StaffAvatarUpload` component also queues biometric sync on upload. So staff photo sync **already works** for employees/trainers when their avatar is uploaded via the HRM or Trainer edit flows.

What's missing: There's no equivalent "Hardware & Biometrics" tab for staff in the employee/trainer profile drawers showing enrollment status, Wiegand code, or sync queue status. The biometric sync queue works but there's no visibility into it for staff.

### 4. View As -- Not Working + Replace with Real Login
**View As issue:** The ViewAs context works correctly -- it changes the sidebar menu and shows the banner. If it's "not working," it may be because route guards in `App.tsx` still check the **real** roles (from `useAuth`), not the viewAs role. So when the admin navigates to `/member-dashboard`, the `ProtectedRoute` component may block access because the real user doesn't have the `member` role. Need to check and fix `ProtectedRoute.tsx` to respect ViewAs.

**User wants specific logins, not demo mode:** The user wants admins to create **real login accounts** for each staff member, trainer, manager, and member -- not a "view as" preview. The system already supports this via:
- `AdminUsers.tsx` page at `/admin/users` -- creates users with any role
- `create-staff-user` edge function -- creates trainer/staff/manager accounts
- `create-member-user` edge function -- creates member accounts
- `AddEmployeeDrawer`, `AddTrainerDrawer`, `AddMemberDrawer` -- all invoke these functions

The issue is that the `admin-create-user` function only allows `admin`/`owner` roles (line 89-93). For all other roles, `create-staff-user` handles it. The AdminUsers page (`/admin/users`) only calls `admin-create-user` which rejects non-admin roles. This is the bug -- the AdminUsers page should route to the correct edge function based on role selection.

---

## Implementation Plan

### Step 1: Fix AdminUsers Page -- Unified User Creation
**File:** `src/pages/AdminUsers.tsx`

- When role is `admin` or `owner`, call `admin-create-user` (current behavior)
- When role is `manager`, `staff`, or `trainer`, call `create-staff-user` instead
- When role is `member`, call `create-member-user` instead
- This makes the Admin User Management page a **single unified hub** for creating any type of user account
- Show the generated temporary credentials or confirm "they will set password on first login"

### Step 2: Add Avatar Upload to Profile Page
**File:** `src/pages/Profile.tsx`

- Replace the static `Avatar` display (lines 113-119) with the existing `AvatarUpload` component
- Import `AvatarUpload` from `@/components/auth/AvatarUpload`
- The AvatarUpload component already handles upload to `avatars` bucket, profile update, and refresh

### Step 3: Fix View As Route Protection
**File:** `src/components/auth/ProtectedRoute.tsx`

- Import `useViewAs` and check `viewAsRole`
- When `isViewingAs` is true and the real user is admin/owner, bypass the role check -- allow navigation to any role's pages
- This makes "View As" actually work for previewing other role dashboards

### Step 4: Device Management UI Polish
**File:** `src/pages/DeviceManagement.tsx`

- Add `serial_number` and `last_sync` columns to the device table
- Show branch name in the device row (join from branches context)
- Clean up the `ip_address` type casting in `deviceService.ts`

### Step 5: Staff Biometric Visibility (Minor)
No new tab needed. The staff biometric sync already works via `StaffAvatarUpload`. The sync queue status can be viewed on the Device Management page. This is already functional.

---

## Files Summary

| Action | File | Description |
|--------|------|-------------|
| Edit | `src/pages/AdminUsers.tsx` | Route to correct edge function per role |
| Edit | `src/pages/Profile.tsx` | Add AvatarUpload component |
| Edit | `src/components/auth/ProtectedRoute.tsx` | Respect ViewAs for admin impersonation |
| Edit | `src/pages/DeviceManagement.tsx` | Add SN/last_sync columns |
| Edit | `src/services/deviceService.ts` | Clean up ip_address type casting |

