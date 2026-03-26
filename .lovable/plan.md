

# Incline Gym 2.0: Cloud-Only MIPS Integration

## Architecture Confirmation

All communication goes through MIPS middleware at `http://212.38.94.228:9000`. No LAN/device-direct calls.

```text
PUSH (Server → Device):
  Supabase Edge Function → MIPS :9000 API (JWT auth) → MIPS TCP tunnel → Device

PULL (Device → Server):
  Device → MIPS middleware → Webhook POST → mips-webhook-receiver → CRM Database
```

## Three Tasks

### Task 1: Fix sync-to-mips — Add Photo Upload + Personnel Dispatch

**Current problem**: `personPhotoUrl: []` and `personPhotoId: []` are sent as empty arrays. The device receives person data but no face, so recognition fails.

**Fix**: After creating the employee record in MIPS, we need to:
1. Fetch the member's avatar/biometric photo from Supabase Storage
2. Download it, verify it's JPG and under 400KB (resize if needed using canvas-free server-side approach)
3. Convert to base64 and include in the `personPhotoUrl` field of the MIPS payload (MIPS accepts base64 photo data in the employee save endpoint)
4. After successful save, immediately call the **Personnel Issue** endpoint (`POST /admin/person/employees/permission`) targeting device SN `D1146D682A96B1C2` to push data to the physical turnstile

**Changes to `supabase/functions/sync-to-mips/index.ts`**:
- Add photo fetch from Supabase Storage (try `biometric_photo_url` first, then `avatar_url`)
- Download the image, convert to base64
- Include base64 photo in the MIPS payload (`personPhotoUrl` array)
- After successful person creation, call the permission/dispatch endpoint targeting the specific device by querying online devices and filtering for the target SN

### Task 2: Fix Webhook Response Format

**Current problem**: Returns `{"code": 200, "msg": "Successful!"}` but the hardware expects `{"result":1,"code":"000"}`. Wrong format causes retries and potential flooding.

**Changes to `supabase/functions/mips-webhook-receiver/index.ts`**:
- Change success response from `{"code": 200, "msg": "Successful!"}` to `{"result":1,"code":"000"}`
- Change error response similarly to `{"result":1,"code":"000"}` (always acknowledge to prevent retries)
- Also handle the LAN callback field names (`personId` instead of `personNo`, `type` field for face_0/face_1/face_2, `deviceKey` for device SN, `searchScore`/`livenessScore`)
- Map `type: "face_0"` → authorized, `"face_1"` → outside passtime, `"face_2"` → stranger

### Task 3: Dashboard Device Status via MIPS API

**Current state**: The dashboard already polls MIPS via `fetchMIPSDevices()` which calls `/admin/devices/page`. This is correct and cloud-only. No LAN polling exists in production code.

**Minor enhancement**: Ensure the device list shows the `deviceKey` (SN) so operators can identify `D1146D682A96B1C2`. Update `MIPSDevicesTab` to display device SN prominently.

## Files to Modify

| File | Change |
|---|---|
| `supabase/functions/sync-to-mips/index.ts` | Add photo fetch/base64 encoding, include in payload, add post-sync device dispatch |
| `supabase/functions/mips-webhook-receiver/index.ts` | Fix response to `{"result":1,"code":"000"}`, handle LAN callback field names |
| `src/components/devices/MIPSDevicesTab.tsx` | Show device SN (deviceKey) in device cards |
| `src/services/mipsService.ts` | Add `dispatchToDevice(personMipsId, deviceSN)` helper |

## Implementation Notes

- Photo handling in the edge function will use `fetch()` to download from Supabase Storage public URL, read as `ArrayBuffer`, convert to base64 using `btoa`/`Uint8Array`
- The MIPS `personPhotoUrl` field accepts base64-encoded image data (common pattern for this Chinese middleware family)
- If photo is larger than 400KB, we'll skip it and log a warning (compression should happen client-side before upload via the existing `compressImageForDevice` utility)
- The dispatch step uses the existing `assignDevicePermission` function but ensures the specific device with SN `D1146D682A96B1C2` is targeted

