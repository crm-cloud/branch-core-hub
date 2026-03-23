

# Device Integration: Complete Fix & UI Redesign

## Critical Issues Found in Live Audit

### Database State (Live)
- **6 active members**, all with `hardware_access_enabled=true`, **0 with photos**
- **2 active staff**, 0 with photos
- **2 active trainers**, 0 with photos
- **27,620 access log events**: 16,825 `not_found` + 10,795 `stranger` — **zero successful identifications**
- **SN mismatch**: `access_devices` has SN `01MA10`, but the device heartbeats as `D1146D682A96B1C2`

### Root Causes

**1. Members never sync to device because of SN mismatch**

The `terminal-register` endpoint resolves `branchId` by looking up the device SN in `hardware_devices`. The device sends `D1146D682A96B1C2` which exists in `hardware_devices` with `branch_id`. BUT the `access_devices` table has `01MA10` as SN. These are two different records for the same physical device. The roster pull works, but the `syncBranchMembersToDevices()` client function looks up devices from `access_devices` — and the SN there doesn't match what the terminal actually sends. Result: the device gets roster data from the edge function, but the app's "Sync Members" button targets the wrong device record.

**2. App-side sync requires photos, but nobody has photos**

`syncBranchMembersToDevices()` filters `.not('biometric_photo_url', 'is', null)` — since all 6 members have `null` photos, zero items are synced. The edge function (`terminal-register`) correctly returns members without photos, but the app's sync button effectively does nothing.

**3. Avatar and biometric photo are separate concepts**

Per user preference: avatar = biometric photo (reuse). Currently they're stored separately (`avatar_url` on profiles vs `biometric_photo_url` on members). When a member uploads an avatar, it doesn't populate `biometric_photo_url` and vice versa.

**4. No bi-directional sync mechanism**

The device can pull roster (via `terminal-register`), but the **app cannot push** data to the device. The stock APK only calls out via callbacks — the app cannot reach the device's local API. Sync is one-directional: device pulls from cloud. The "Sync Members" button in the UI queues items to `biometric_sync_queue` but nothing ever reads that queue to push to the device.

**5. Staff attendance via terminal only creates one check-in record**

The `terminal-identify` function inserts into `staff_attendance` on every identification, but doesn't check for existing open attendance (no check-out logic). Each face scan creates a duplicate attendance row.

## The Fix

### Step 1: Fix SN Mismatch (Data)

Update the `access_devices` record to use the actual device SN `D1146D682A96B1C2` that the terminal reports. Clean up the stale `hardware_devices` entries (`01MA10`, `DUMMY-SN-001`).

### Step 2: Unify Avatar = Biometric Photo

When a member/staff/trainer uploads or changes their avatar (`avatar_url` on profiles), auto-copy it to `biometric_photo_url` on the corresponding `members`/`employees`/`trainers` row. When the terminal captures a face (via register callback with `imageUrl`), save it to both `biometric_photo_url` AND `avatar_url` on the profile.

**Files**: `terminal-register/index.ts` (register callback section), `MemberAvatarUpload.tsx`, `EditProfileDrawer.tsx`, `StaffBiometricsTab.tsx`

### Step 3: Fix App-Side Sync to Work Without Photos

Remove the `.not('biometric_photo_url', 'is', null)` filter from `syncBranchMembersToDevices()`. Members without photos should still be synced (name + ID) so the device can capture their face locally.

**File**: `src/services/biometricService.ts`

### Step 4: Fix Staff Attendance Duplicate Check-Ins

Update `terminal-identify` to check for existing open `staff_attendance` (where `check_out IS NULL` and `check_in` is today). If found, update `check_out` instead of inserting a new row.

**File**: `supabase/functions/terminal-identify/index.ts`

### Step 5: Enable Realtime on `hardware_devices`

So the UI can show live connection status updates without manual refresh.

**Migration**: `ALTER PUBLICATION supabase_realtime ADD TABLE public.hardware_devices;`

### Step 6: Redesign Device Management UI

The current UI has functional gaps:

**New layout structure:**

```text
+-------------------------------------------------------+
| Device Management                    [Refresh] [+ Add] |
+-------------------------------------------------------+
| Stats Row: Total | Online | Enrolled | Pending Sync    |
+-------------------------------------------------------+
| Tab: Devices | Tab: Live Feed | Tab: Roster Status     |
+-------------------------------------------------------+

Devices Tab:
- Per-device cards (not table) showing:
  - Name, SN, status indicator (live pulse)
  - Last heartbeat (relative time)
  - Enrolled count / roster size
  - Expand: Setup URLs, quick actions

Live Feed Tab:
- Current LiveAccessLog component (already good)

Roster Status Tab:
- Personnel list showing sync state per person
  - Name, role, has photo, enrolled on device, expiry
  - Action: "Capture on Device" / "Upload Photo"
  - Bulk sync button
```

**Key UI additions:**
- Per-device enrolled member count (query `access_logs` for unique successful identifications)
- "Test Roster Pull" button that calls `terminal-register` and shows the response
- SN auto-detection: when `hardware_devices` has a device not in `access_devices`, show a prompt to link them
- Multi-device support: branch-scoped device cards in a grid

**Files**: `src/pages/DeviceManagement.tsx` (major rewrite), `src/components/devices/DeviceSetupCard.tsx` (enhance), new `src/components/devices/RosterStatusTab.tsx`

### Step 7: Clean Up Access Logs Table

27K+ stranger/not_found events are noise. Add a "Clear Logs" button for admins to purge old events. Add pagination to the live feed.

## Files to Create/Modify

| File | Change |
|------|--------|
| Data fix | Update `access_devices` SN to `D1146D682A96B1C2`, clean stale `hardware_devices` |
| Migration | Enable realtime on `hardware_devices` |
| `src/services/biometricService.ts` | Remove photo requirement from sync, add avatar-to-biometric bridge |
| `supabase/functions/terminal-identify/index.ts` | Add staff check-in/check-out toggle, avatar sync on face capture |
| `supabase/functions/terminal-register/index.ts` | Save captured face to both `biometric_photo_url` and profile `avatar_url` |
| `src/components/members/MemberAvatarUpload.tsx` | Auto-update `biometric_photo_url` when avatar changes |
| `src/pages/DeviceManagement.tsx` | Full UI redesign with tabs, per-device cards, roster status |
| `src/components/devices/DeviceSetupCard.tsx` | Add enrolled count, test roster button |
| New: `src/components/devices/RosterStatusTab.tsx` | Personnel sync status view |

## Execution Order
1. Fix SN mismatch (data update)
2. Enable realtime on `hardware_devices`
3. Unify avatar = biometric photo (edge functions + components)
4. Fix sync to work without photos
5. Fix staff attendance duplicate check-ins
6. Redesign Device Management UI
7. End-to-end test via curl

