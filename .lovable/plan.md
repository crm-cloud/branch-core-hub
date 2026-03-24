

# Fix MIPS Integration: Correct API Endpoints and Payloads

## Root Cause (from user's curl captures)

The current code is calling wrong endpoints with wrong methods and wrong payloads. Here are the actual MIPS API contracts discovered:

### Personnel Save
- **Correct**: `POST /admin/person/employees` with JSON body and `siteId: 1` header
- **Current (broken)**: Tries `/admin/person/employees/save`, `/apiExternal/person/save`, `/apiExternal/employee/save` -- all 404

### Open Door
- **Correct**: `PUT /admin/devices/remote/opendoor` with `{"ids":[22]}` (device numeric IDs)
- **Current (broken)**: `POST /admin/devices/openDoor` with `{"deviceKey":"..."}` -- wrong method, wrong path, wrong payload

### Photo Upload
The curl shows `personPhotoId: [12]` -- photos are uploaded separately to MIPS first, then referenced by ID. Current code sends `imgBase64` inline which MIPS does not accept on this endpoint.

---

## Plan

### 1. Fix `sync-to-mips` edge function
- Change endpoint to `POST /admin/person/employees`
- Add `siteId: 1` header
- Match exact payload structure from the curl:
  - `id: ""` (empty for new), `personNo`, `name`, `phone`, `email`, `gender: 1`
  - `beginTime`, `expireTime` in `YYYY-MM-DD HH:mm:ss` format
  - `attendanceFlag: true`, `attendanceRuleId: 1`
  - Remove `imgBase64` / `department` fields (not in MIPS contract)
  - For photos: skip for now (requires separate upload API), set `personPhotoId: []`
- Remove the multi-endpoint retry loop -- we now know the exact endpoint
- Keep chunked base64 helper for future photo upload support

### 2. Fix `mips-proxy` edge function
- Add `siteId: 1` header to all proxied requests
- Support `PUT` method (currently only handles POST/GET effectively)
- Already supports PUT in the method passthrough, just need to verify

### 3. Fix `remoteOpenDoor` in mipsService.ts
- Change endpoint to `/admin/devices/remote/opendoor`
- Change method to `PUT`
- Change payload from `{ deviceKey }` to `{ ids: [deviceId] }` where `deviceId` is the numeric MIPS device ID (not the deviceKey string)
- Update `MIPSDevice` interface to ensure `id` (numeric) is available
- Update `MIPSDevicesTab.tsx` to pass `device.id` instead of `device.deviceKey`

### 4. Update `restartDevice` in mipsService.ts
- Likely needs similar fix (PUT method, different endpoint) -- will match pattern from open door

### 5. Update Debug tab in DeviceManagement.tsx
- Ensure debug buttons use corrected endpoints

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/sync-to-mips/index.ts` | Single correct endpoint, exact payload, `siteId` header |
| `supabase/functions/mips-proxy/index.ts` | Add `siteId: 1` header to all requests |
| `src/services/mipsService.ts` | Fix open door endpoint/method/payload |
| `src/components/devices/MIPSDevicesTab.tsx` | Pass device `id` (numeric) for door open |

