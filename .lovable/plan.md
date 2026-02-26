

# Master IoT Integration: Face Enrollment, Smart Sync & Realtime Commands

## Existing Infrastructure Assessment

The codebase already has a solid foundation:
- **`access_devices`** table with relay_mode, relay_delay, is_online, last_heartbeat, last_sync
- **`biometric_sync_queue`** table with member_id, staff_id, photo_url, person_uuid, person_name, sync_type, status
- **`device_access_events`** table logging all access events with member/staff association
- **`device-access-event`** edge function that validates membership and returns OPEN/DENIED with LED color + relay delay
- **`device-sync-data`** edge function for Android polling (returns pending sync items)
- **`device-trigger-relay`** edge function for manual remote open (already RBAC-secured)
- **`biometricService.ts`** with queueMemberSync, queueStaffSync, markSyncComplete
- Members table already has `biometric_photo_url` and `biometric_enrolled` columns

**What's missing:** `wiegand_code`, `custom_welcome_message`, and `hardware_access_enabled` on members. The sync endpoint doesn't return wiegand_code or custom messages. The remote open uses edge functions but lacks Realtime channel for instant push. No Face Enrollment UI card in MemberProfileDrawer.

---

## 1. Database Migration: Add Member Hardware Fields

Add 3 new columns to `members` table:

```sql
ALTER TABLE public.members 
  ADD COLUMN wiegand_code text,
  ADD COLUMN custom_welcome_message text DEFAULT 'Welcome! Enjoy your workout',
  ADD COLUMN hardware_access_enabled boolean DEFAULT true;
```

Create a **`device_commands`** table for Realtime push commands:

```sql
CREATE TABLE public.device_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.access_devices(id) ON DELETE CASCADE NOT NULL,
  command_type text NOT NULL DEFAULT 'relay_open',
  payload jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  issued_by uuid REFERENCES public.profiles(id),
  issued_at timestamptz DEFAULT now(),
  executed_at timestamptz
);

-- Enable Realtime for device_commands so Android app can subscribe
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_commands;
```

RLS policies:
- Admin/owner/manager/staff can INSERT into `device_commands`
- Read access for authenticated users (devices need to read commands)
- Members table update restricted to admin/owner/manager roles for the new hardware fields

A database trigger to **auto-disable hardware access** when membership is frozen/expired:

```sql
CREATE OR REPLACE FUNCTION auto_disable_hardware_access()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('frozen', 'expired', 'cancelled') AND OLD.status = 'active' THEN
    NEW.hardware_access_enabled := false;
  END IF;
  IF NEW.status = 'active' AND OLD.status IN ('frozen', 'expired') THEN
    NEW.hardware_access_enabled := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_hardware_access
  BEFORE UPDATE OF status ON public.members
  FOR EACH ROW EXECUTE FUNCTION auto_disable_hardware_access();
```

---

## 2. Member Profile Drawer: Face Enrollment Card

**File:** `src/components/members/MemberProfileDrawer.tsx`

Add a new **"Hardware & Biometrics"** tab (or card within Overview tab) containing:

- **Face Enrollment Photo**: Large avatar showing `biometric_photo_url` with an upload button. Uploading triggers `queueMemberSync()` to push to all face terminals. Uses `MemberAvatarUpload`-style component targeting the `member-photos` bucket.
- **Wiegand Code**: Text input field for the numeric Wiegand ID (card/chip number). Saved to `members.wiegand_code`.
- **Custom Welcome Message**: Text input with placeholder "Welcome, {name}! Enjoy your workout". Saved to `members.custom_welcome_message`.
- **Hardware Access Toggle**: Switch component showing Enabled/Disabled. Displays a warning if member is frozen/expired ("Auto-disabled due to frozen membership"). Saved to `members.hardware_access_enabled`.
- **Enrollment Status**: Badge showing "Enrolled" (green) or "Pending Sync" (yellow) or "Not Enrolled" (gray) based on `biometric_enrolled` status.
- **Sync Status List**: Shows per-device sync status from `biometric_sync_queue` (which devices have synced, which are pending/failed).

All fields update the `members` table directly via Supabase mutation with React Query invalidation.

---

## 3. Enhanced Smart Sync Endpoint

**File:** `supabase/functions/device-sync-data/index.ts`

The current endpoint returns only pending `biometric_sync_queue` items. Enhance it to support a **full roster mode** that the Android app can use for initial sync or periodic refresh:

**New query parameter:** `?mode=full` (in addition to existing `?device_id=xxx`)

When `mode=full`:
- Query ALL members for the device's branch where `hardware_access_enabled = true`
- For each member, return:
  - `member_id` (person_uuid)
  - `wiegand_code`
  - `avatar_url` (biometric_photo_url)
  - `custom_message` (custom_welcome_message)
  - `access_allowed` (boolean: true only if member has active membership AND hardware_access_enabled = true)
  - `person_name`
- Also include staff with biometric photos from the same branch

When `mode=incremental` (default, current behavior):
- Keep existing sync queue logic but add `wiegand_code` and `custom_message` to the response payload

**Updated response shape for full sync:**
```json
{
  "device_id": "...",
  "mode": "full",
  "members": [
    {
      "member_id": "uuid",
      "wiegand_code": "12345",
      "avatar_url": "https://...",
      "custom_message": "Welcome, John!",
      "access_allowed": true,
      "person_name": "John Doe"
    }
  ],
  "server_time": "..."
}
```

---

## 4. Enhanced Access Event Endpoint

**File:** `supabase/functions/device-access-event/index.ts`

Update the response to include the member's `custom_welcome_message`:
- After finding the member, read `custom_welcome_message` from the members table
- If set, use it instead of the generic "Welcome, {name}!" message (replacing `{name}` with the actual name)
- Return the custom message in the `message` field of the response

Also add `wiegand_code` lookup: if the `person_uuid` doesn't match a member ID directly, try matching by `wiegand_code` as a fallback identifier.

---

## 5. Realtime Remote Open via `device_commands` Table

**Current state:** The "Remote Open" button calls the `device-trigger-relay` edge function, which logs an event but cannot actually push a signal to the device in real-time.

**New approach:** Use Supabase Realtime channels:
1. Admin clicks "Remote Open" on Device Management page
2. Frontend inserts a row into `device_commands` with `command_type: 'relay_open'` and `payload: { duration: 5 }`
3. The Android app subscribes to Realtime changes on `device_commands` filtered by its `device_id`
4. When the Android receives the INSERT event, it calls `smdt.setRelayIoValue(1)` for the specified duration
5. Android then updates the row's `status` to `'executed'` and sets `executed_at`

**Frontend changes in `DeviceManagement.tsx`:**
- Update the "Remote Open" button handler to insert into `device_commands` instead of (or in addition to) calling the edge function
- Show real-time feedback: "Command sent..." -> "Executed" when the Android updates the row

**Service update in `deviceService.ts`:**
- Add `sendDeviceCommand(deviceId, commandType, payload)` function
- Add `subscribeToCommandStatus(commandId, callback)` for tracking execution

---

## 6. Access Log Enhancements

The `LiveAccessLog` component and `device_access_events` table already handle this well. Minor enhancements:
- Add member's `biometric_photo_url` to the access log display (show the captured face photo alongside the event)
- Add Wiegand code display in the log entry if present

---

## Files Summary

| Action | File | Description |
|--------|------|-------------|
| Migration | SQL | Add wiegand_code, custom_welcome_message, hardware_access_enabled to members; create device_commands table with Realtime; auto-disable trigger |
| Edit | `src/components/members/MemberProfileDrawer.tsx` | Add "Hardware & Biometrics" tab with face enrollment, wiegand, welcome message, access toggle |
| Edit | `supabase/functions/device-sync-data/index.ts` | Add full roster sync mode with wiegand_code, custom_message, access_allowed |
| Edit | `supabase/functions/device-access-event/index.ts` | Use custom_welcome_message in responses, wiegand_code fallback lookup |
| Edit | `src/services/deviceService.ts` | Add sendDeviceCommand(), subscribeToCommandStatus() |
| Edit | `src/pages/DeviceManagement.tsx` | Use Realtime device_commands for Remote Open instead of edge function only |
| Edit | `src/components/devices/LiveAccessLog.tsx` | Show biometric photo in access log entries |

## Execution Order

| Step | Priority | Description |
|------|----------|-------------|
| 1 | Critical | Database migration (new columns + device_commands table + trigger) |
| 2 | Critical | Face Enrollment UI in MemberProfileDrawer |
| 3 | High | Enhanced device-sync-data endpoint (full roster mode) |
| 4 | High | Enhanced device-access-event (custom messages + wiegand fallback) |
| 5 | Medium | Realtime device_commands for Remote Open |
| 6 | Low | Access log photo display enhancement |

