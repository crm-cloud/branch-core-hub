

# Advanced IoT Fleet Integration (MIPS v3)

## Current State Summary

The system currently has a hardcoded `TARGET_DEVICE_ID = 13` in `sync-to-mips`. The `access_devices` table exists with `serial_number` and `branch_id` but has no `mips_device_id` column to map to MIPS numeric device IDs. Photo upload uses `/common/uploadHeadPhoto` (multipart) but does not enforce JPG conversion or 400KB compression. The remote capture endpoint `/through/device/capturePhoto` is guessed — the manual shows "Click to Open Camera to Take a Photo" as a UI action, not necessarily an API endpoint. The webhook receiver already returns `{"result":1,"code":"000"}` correctly.

## Key Findings from Manual & API Docs

1. **Photo rules** (from manual page 12): "Only support .jpg format", "Each portrait file size should not exceed 400k"
2. **Remote open door**: `GET /through/device/openDoor/{deviceId}` — already implemented in `mipsService.ts`
3. **Remote photo capture**: The manual mentions "Click to Open Camera to Take a Photo" on the employee edit page — this is a UI-level action. The API endpoint needs curl-testing to confirm. Most likely it's `POST /through/device/capturePhoto` or similar.
4. **Personnel dispatch**: Uses `POST /through/device/syncPerson` with `deviceIds` as an array — already supports multi-device by passing multiple IDs
5. **Webhook ImgReg**: The device sends face scan callbacks to the webhook URL. For registration callbacks, the payload includes `imgUri` which can be saved.

## Implementation Plan

### 1. Multi-Device Dispatch (sync-to-mips)

**Problem**: Hardcoded `TARGET_DEVICE_ID = 13`.

**Fix in `supabase/functions/sync-to-mips/index.ts`**:
- Remove `const TARGET_DEVICE_ID = 13`
- After upsert+photo, query `access_devices` table for all active devices in the person's branch (or all if no branch filter)
- For each device, look up its MIPS device ID: either store `mips_device_id` on `access_devices` table, or fetch MIPS device list and match by `serial_number` → `deviceKey`
- Dispatch to ALL matched device IDs in a single `syncPerson` call (the API supports `deviceIds: [13, 14, 15]`)

**Migration**: Add `mips_device_id` integer column to `access_devices` to cache the MIPS numeric ID per device.

### 2. Photo Sync Fix — JPG Conversion + 400KB Compression

**Fix in `supabase/functions/sync-to-mips/index.ts` `uploadPhoto()` function**:
- After fetching the image bytes, check content-type
- If PNG/WebP, convert to JPEG (in Deno, use canvas or sharp-like lib — or simply ensure the upload always uses `image/jpeg` content-type and `.jpg` extension since MIPS only accepts JPG)
- If size > 400KB, reject or attempt to re-fetch a smaller version
- The existing code already checks `> 500KB` — tighten to `400KB` per manual spec
- Always use `image/jpeg` content-type and `.jpg` filename extension regardless of source format

### 3. Remote Capture — Device Camera Photo

**Add to `mipsService.ts`**: The `capturePhoto` function already exists but calls `/through/device/capturePhoto`. This endpoint needs verification via curl. The manual references a "take photo" UI action on the employee edit page.

**Alternative approach**: Based on the manual's "Register Person Data Upload URL" callback config (page 9), when the device captures a registration photo, it sends a callback (`ImgReg` event) to the configured URL. The flow would be:
1. Trigger capture via MIPS API (needs curl testing for exact endpoint)
2. Device takes photo and sends callback to `mips-webhook-receiver`
3. Webhook receives the `imgUri` / base64 image data
4. Save image to Supabase Storage `member-photos` bucket
5. Update the member's `biometric_photo_url`

**Fix in `mips-webhook-receiver`**: Add handler for `ImgReg` / registration callback events — save the photo to storage and update CRM.

### 4. Entry Override — Remote Open Door

**Add to `AttendanceDashboard.tsx`**:
- Add an "Override Entry" button (visible to admin/manager roles)
- When clicked, fetch the member's branch → find the active `access_device` for that branch → get its `mips_device_id` → call `remoteOpenDoor(mipsDeviceId)`
- The `remoteOpenDoor` function already exists in `mipsService.ts` using `GET /through/device/openDoor/{deviceId}`

### 5. Trainer deptId Fix

**Already fixed** in the previous iteration: trainers use `deptId: 101` (Staff department). This is correct per the mapping.

### 6. Webhook Response Fix

**Already correct**: The webhook returns `{"result":1,"code":"000"}` on both success and error paths (lines 256-266 of `mips-webhook-receiver/index.ts`).

## Files to Modify

| File | Change |
|---|---|
| Migration SQL | Add `mips_device_id` (integer) to `access_devices` |
| `supabase/functions/sync-to-mips/index.ts` | Remove hardcoded device ID, query access_devices for multi-device dispatch, tighten photo to 400KB + force JPG |
| `supabase/functions/mips-webhook-receiver/index.ts` | Add `ImgReg` callback handler to save captured photos |
| `src/services/mipsService.ts` | Add `remoteOpenDoorByBranch()` helper |
| `src/pages/AttendanceDashboard.tsx` | Add "Override Entry" button calling remote open door |
| `src/components/devices/PersonnelSyncTab.tsx` | Show "(Main Branch)" label when "All Branches" is active |
| `.lovable/mips-api-reference.md` | Update with multi-device dispatch and photo rules |

## Testing Strategy

Before implementing, curl-test:
1. `POST /through/device/syncPerson` with `deviceIds: [13]` array — confirm multi-device dispatch format
2. Test photo upload with forced `.jpg` extension and `image/jpeg` content-type
3. Test capture photo endpoint (`/through/device/capturePhoto` or similar) — discover exact API
4. `GET /through/device/openDoor/13` — confirm remote door open works

