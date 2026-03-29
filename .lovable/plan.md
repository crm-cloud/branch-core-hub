

# Comprehensive Audit & Fix: Device Sync Lifecycle, FK Error, and UI/UX Upgrade

## Bugs Found

### Bug 1: "2099" Frozen VIP Pass (CRITICAL)
**File**: `supabase/functions/revoke-mips-access/index.ts` lines 192-194
When restoring access and no active membership is found, the fallback is `"2099-12-31 23:59:59"` — giving lifetime access. The same `2099` fallback exists in `sync-to-mips/index.ts` line 8 (`PERMANENT_END`), used for staff/trainers (correct for them) but the restore function should never default to 2099 for members.

**Fix**: When `action === "restore"` and no active membership is found, return an error instead of granting 2099 access. Only send the actual membership `end_date`.

### Bug 2: Foreign Key Alias Crash (120 errors in System Health)
**File**: `src/components/devices/LiveAccessLog.tsx` line 81
Query uses `profiles:members_user_id_fkey(full_name, avatar_url)` — this explicit FK name is fragile and breaks when schema cache changes.

**Fix**: Change to `profiles:user_id(full_name, avatar_url)` which uses the column-based hint PostgREST supports.

### Bug 3: QuickFreezeDrawer doesn't revoke hardware access
**File**: `src/components/members/QuickFreezeDrawer.tsx`
When a quick freeze is applied (status → frozen), no call is made to `revokeHardwareAccess()`. The gate stays open.

**Fix**: Add `revokeHardwareAccess()` call after successful freeze.

### Bug 4: FreezeMembershipDrawer doesn't revoke hardware access
**File**: `src/components/members/FreezeMembershipDrawer.tsx`
The approval-based freeze also doesn't trigger hardware revocation. Even though it creates an approval request, the `auto_freeze_membership` trigger that fires on approval doesn't call the edge function.

**Fix**: The freeze approval workflow changes status to 'frozen' via a DB trigger. We need to handle this in the `QuickFreezeDrawer` (which bypasses approval) and document that approval-based freezes need a manual or automated revocation step.

### Bug 5: UnfreezeMembershipDrawer uses `original_end_date` which may not exist
**File**: `src/components/members/UnfreezeMembershipDrawer.tsx` line 41
References `membership.original_end_date` — this field may not be populated, causing the new end date calculation to fail.

**Fix**: Fall back to calculating from the current `end_date` minus already-used freeze days, or use `end_date` directly when `original_end_date` is null.

## Implementation Plan

### Step 1: Fix `revoke-mips-access` — Remove 2099 fallback for members
- When `action === "restore"` and no active membership exists, do NOT default to 2099
- Instead, return `{ success: false, error: "No active membership found to restore" }`
- Keep 2099 only for staff/trainers in `sync-to-mips` (which is correct)

### Step 2: Fix LiveAccessLog FK query
- Change `profiles:members_user_id_fkey(full_name, avatar_url)` → `profiles:user_id(full_name, avatar_url)`
- This eliminates all 120 database errors shown in System Health

### Step 3: Add hardware revocation to QuickFreezeDrawer
- Import `revokeHardwareAccess` from `membershipService`
- After successful freeze (line 77), call `revokeHardwareAccess(member.id, 'Membership frozen', activeMembership.branch_id)`

### Step 4: Fix UnfreezeMembershipDrawer end-date calculation
- Handle missing `original_end_date` by using `end_date` as fallback
- After successful unfreeze, `restoreHardwareAccess` is already called (line 61) — confirmed working

### Step 5: Enhance Device Management UI/UX
- Improve the Dashboard hero card with better status indicators
- Add a "Check Expired Access" button to trigger the `check-expired-access` edge function
- Add visual indicators for `hardware_access_status` on device cards

## Files to Modify

| File | Change |
|---|---|
| `supabase/functions/revoke-mips-access/index.ts` | Remove 2099 fallback; require active membership for restore |
| `src/components/devices/LiveAccessLog.tsx` | Fix FK alias `members_user_id_fkey` → `user_id` |
| `src/components/members/QuickFreezeDrawer.tsx` | Add `revokeHardwareAccess()` call after freeze |
| `src/components/members/UnfreezeMembershipDrawer.tsx` | Fix `original_end_date` fallback |
| `src/components/devices/MIPSDashboard.tsx` | Add "Check Expired Access" action button |
| `src/pages/DeviceManagement.tsx` | Minor UI polish |

