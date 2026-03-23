

# Device Integration: Deep Cleanup & Feature Build

## Phase 1: Database Cleanup

### Tables to DELETE (proposing for your confirmation)
| Table | Rows | Reason |
|-------|------|--------|
| `device_access_events` | 8 | Legacy table — all real events go to `access_logs` (28,977 rows). Only referenced by `fetchAccessEvents()` in `deviceService.ts` which is unused in the UI. |

### Tables to KEEP
| Table | Rows | Purpose |
|-------|------|---------|
| `access_devices` | 1 | Primary device registry — UI reads from this |
| `hardware_devices` | 1 | Edge function auto-upsert table for heartbeat tracking |
| `access_logs` | 28,977 | All terminal events (identify, heartbeat, register) |
| `biometric_sync_queue` | 10 | Tracks sync status per person per device |
| `device_commands` | — | Relay/command queue (used by sendDeviceCommand) |

### Edge Functions — All 3 are ACTIVE and NEEDED
- `terminal-heartbeat` — device heartbeat receiver
- `terminal-identify` — face scan callback
- `terminal-register` — roster pull + face registration callback

No edge functions to delete. These are the only hardware-related functions and they are production-critical.

### Data Cleanup
- Purge ~28K noise rows from `access_logs` where `result IN ('stranger', 'not_found')` and `created_at < now() - interval '7 days'` — keeps recent events for debugging but removes historical noise.

---

## Phase 2: UI/UX Fixes

### 1. Device Status — Fix Online Threshold
Current code uses 120 seconds (2 min). Change to **180 seconds (3 min)** per your spec in both `DeviceManagement.tsx` (`isDeviceOnline`) and `deviceService.ts` (`getDeviceStats`).

### 2. Sync Status on Member Profile
Add a small sync status indicator to `MemberProfileDrawer` (in the Hardware/Access tab) showing the `biometric_sync_queue` status for that member: "Queued", "Synced", or "Failed" with timestamp.

---

## Phase 3: Core Features

### 1. Remote Relay (Remote Open Door)
The `device_commands` table and `sendDeviceCommand()` already exist. The "Relay" button already exists on each device card. The issue is the device (stock APK) doesn't poll for commands — it only pushes callbacks. 

**Solution**: Add a relay command to the `terminal-heartbeat` response. When the device sends a heartbeat, check `device_commands` for pending commands and return them in the response payload. The stock APK may or may not honor this — document this limitation. The button already works for UI queuing.

### 2. Photo Compression Utility
Create a client-side utility (`src/utils/imageCompression.ts`) that:
- Resizes to max 640x640
- Compresses to JPEG under 200KB
- Returns Base64 string
- Used by `MemberAvatarUpload`, `StaffAvatarUpload`, `EditProfileDrawer` before upload

### 3. Remote Photo Capture
Add "Capture via Device" button in Member Profile. This inserts a `device_commands` record with `command_type: 'capture_face'` and `payload: { personId: member.id }`. When the heartbeat response delivers this command, the device captures and POSTs back via `terminal-register` callback.

### 4. Role Mapping in Roster
Update `terminal-register` roster response to include a `department` field:
- `role: 'member'` → `department: 'Normal User'`
- `role: 'staff'` → `department: 'Employee'`  
- `role: 'trainer'` → `department: 'Employee'`
- Admin/Manager → `department: 'Administrator'`

### 5. Expiry Dates
Already implemented — roster includes `expiryDate`, `expiry_date`, `membershipEndDate`. No changes needed.

---

## Phase 4: Debug Tab

Add a "Debug" tab to Device Management (visible to owner/admin only) with:
- E2E test checklist (create member → verify sync → test relay → test expiry → test offline)
- "Test Roster Pull" button that calls `terminal-register` via `supabase.functions.invoke` and shows the response
- Log purge button (clear old stranger/not_found events)

---

## Files to Modify

| File | Change |
|------|--------|
| Migration | Drop `device_access_events`, purge old access_logs |
| `src/pages/DeviceManagement.tsx` | Fix online threshold to 180s, add Debug tab |
| `src/services/deviceService.ts` | Fix threshold to 180s, remove `device_access_events` references |
| `supabase/functions/terminal-heartbeat/index.ts` | Return pending commands in heartbeat response |
| `supabase/functions/terminal-register/index.ts` | Add `department` field for role mapping |
| New: `src/utils/imageCompression.ts` | Client-side image resize/compress utility |
| `src/components/members/MemberAvatarUpload.tsx` | Use compression before upload |
| `src/components/members/MemberProfileDrawer.tsx` | Add sync status indicator, "Capture via Device" button |
| `src/components/members/HardwareBiometricsTab.tsx` | Simplify — remove manual photo upload confusion |

## Execution Order
1. Database cleanup (drop legacy table, purge noise)
2. Fix online threshold (quick win)
3. Add role mapping to roster
4. Build image compression utility
5. Heartbeat command delivery
6. Member profile sync status + capture button
7. Debug tab with E2E checklist

