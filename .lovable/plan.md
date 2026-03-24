

# Fix MIPS PersonNo Hyphen Issue + Add Permission Assignment & Photo Capture

## Problem

The `generate_member_code` DB trigger creates codes like `MAIN-00005` (branch code + hyphen + number). The MIPS device only accepts alphanumeric characters -- no hyphens. This means synced persons with hyphenated codes get rejected or mangled by MIPS, breaking face recognition matching.

Additionally, from the user's curl captures, two new MIPS API endpoints are now known:
- **Permission assignment**: `POST /admin/person/employees/permission` -- assigns a synced person to specific devices
- **Remote photo capture**: `POST /admin/person/employees/take_photo` -- triggers the device camera to capture a face photo for a person

## Plan

### 1. Strip hyphens from `personNo` when syncing to MIPS

In `sync-to-mips/index.ts`, transform the member/employee code before sending:
```
MAIN-00005 → MAIN00005
MAIN2-00001 → MAIN200001
```

Simple `.replace(/-/g, "")` on the `personNo` field before building the MIPS payload. This keeps the original `member_code` in the database unchanged (it is used throughout the app UI), but sends a MIPS-compatible version.

Store the hyphen-stripped version as `mips_person_id` in the database so the webhook receiver can match it back.

### 2. Update webhook receiver to match both formats

In `mips-webhook-receiver/index.ts`, the lookup chain already checks `mips_person_id` first, then falls back to `member_code`. Since we'll store the stripped code as `mips_person_id`, webhook matching will work automatically. Add one more fallback: try stripping hyphens from the incoming `personNo` and matching against `member_code` with hyphens re-inserted (unlikely needed but defensive).

### 3. Add device permission assignment after sync

From the curl capture, after creating a person in MIPS, you must assign them to devices via:
```
POST /admin/person/employees/permission
{"dealWithType":1, "ids":["7"], "deviceIds":[22], "passTimes":[], "passDealType":1}
```

Update `sync-to-mips/index.ts` to:
- After successful person save, fetch all online MIPS device IDs
- Call the permission endpoint to authorize the person on all devices
- Log the permission result

### 4. Add remote photo capture support

New function in `mipsService.ts`:
```typescript
export async function capturePhoto(personMipsId: number, deviceId: number)
```
Calls `POST /admin/person/employees/take_photo` with `{"ids":[personMipsId], "deviceIds":[deviceId]}`.

Add a "Capture Face" button in `PersonnelSyncTab.tsx` for synced persons (those with a `mipsPersonId`), allowing admins to trigger the device to take a photo directly.

### 5. Update `manualSyncTest` verification

When verifying sync, also strip hyphens from the `personNo` being searched in the MIPS roster.

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/sync-to-mips/index.ts` | Strip hyphens from personNo, add permission assignment step |
| `supabase/functions/mips-webhook-receiver/index.ts` | Add hyphen-stripped fallback matching |
| `src/services/mipsService.ts` | Add `capturePhoto` + `assignDevicePermission` functions |
| `src/components/devices/PersonnelSyncTab.tsx` | Add "Capture Face" button for synced persons |

