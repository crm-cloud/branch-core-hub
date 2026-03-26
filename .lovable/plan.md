

# Complete MIPS Sync Fix — Photo Upload, PersonId Lookup, Validity Dates, Attendance

## Audit Findings (from live curl testing)

### Bug 1: `personId = NaN` on dispatch
MIPS `POST /personInfo/person` returns `{"msg":"操作成功","code":200}` with **no `data` field**. Our code reads `createJson.data.personId` → `null` → `parseInt(null)` → `NaN`. Dispatch sends `personId: NaN`.

**Fix**: After creating a person, do a `GET /personInfo/person/list?personSn=<code>` to fetch the actual `personId`.

### Bug 2: Duplicate `personSn` → error 500
When syncing an already-existing person (e.g., MAIN00005), MIPS returns `code:500, "person ID already exists"`. Our code treats this as failure.

**Fix**: First check if person exists. If yes, use `PUT /personInfo/person` (with `personId`). If no, use `POST`.

### Bug 3: Photos not uploading via JSON
`personPhotoUrl` as data URI base64 in the JSON body does NOT save the photo. Live proof: all 8 API-created persons have `photoUri: null` despite photos being sent. Only RAJAT (manually uploaded via MIPS web UI) has a photo.

MIPS requires **multipart/form-data** file upload for photos. The `mips-proxy` only supports JSON forwarding.

**Fix**: Add a `multipart_photo` mode to `mips-proxy` that uploads a JPEG file via multipart form POST to the correct photo endpoint. The edge function will fetch the image from Supabase Storage, then forward it as a multipart upload.

### Bug 4: No validity dates
`validTimeBegin` and `validTimeEnd` are null for all persons. These control device access windows (membership start/end).

**Fix**: Map `memberships.start_date` → `validTimeBegin` and `memberships.end_date` → `validTimeEnd` in the PUT payload.

### Bug 5: Attendance webhook matching
The webhook receiver matches by `mips_person_id`, but since `personId` was stored as `null` (bug 1), no members can be matched from device callbacks. Also, the device sends `personNo` which is `personSn` (e.g., `MAIN00005`), not `personId`.

**Fix**: After fixing bug 1, store the real `personId`. Also update webhook to try matching by `personSn` → member_code lookup.

## Implementation Plan

### 1. Rewrite `supabase/functions/sync-to-mips/index.ts`

The complete sync flow becomes:
```
1. Fetch member/employee data from DB
2. Strip hyphens from code
3. GET /personInfo/person/list?personSn=<stripped> to check existence
4. If exists → PUT /personInfo/person (with personId) to update
   If not → POST /personInfo/person to create
5. GET again to fetch the personId (since create returns no ID)
6. Set validTimeBegin/validTimeEnd from membership dates
7. Upload photo via multipart POST (separate endpoint)
8. Dispatch to device via POST /through/device/syncPerson
9. Store personId in CRM database
```

Key changes:
- Upsert logic (check → create or update)
- Look up `personId` after create
- Map `validTimeBegin`/`validTimeEnd` from membership
- Map `deptId: 100` for members, `101` for staff
- Remove false `personPhotoUrl` from JSON payload
- Photo upload as separate step

### 2. Add multipart photo proxy to `supabase/functions/mips-proxy/index.ts`

Add a new mode when request contains `photo_upload: true`:
- Accepts `{ photo_upload: true, person_sn: "MAIN00005", photo_url: "https://..." }`
- Fetches the photo from the URL
- Builds multipart/form-data with the file named `{personSn}.jpg`
- POSTs to the correct MIPS photo upload endpoint
- Need to discover the exact endpoint (try `/personInfo/person/importPhoto` as multipart)

### 3. Fix `src/services/mipsService.ts`

- Update `verifyPersonOnMIPS` to correctly read `personId` field (not `id`)
- Add `fetchPersonBySn()` helper
- Fix `MIPSEmployee` interface to match actual MIPS response shape (`personId`, `personSn`, `photoUri`, `validTimeBegin`, `validTimeEnd`, `havePhoto`)

### 4. Fix `mips-webhook-receiver` attendance matching

- Primary match: `mips_person_id` (numeric personId stored after fix)
- Fallback: `personSn` → strip/reinsert hyphen → match `member_code`
- The webhook already handles this but `mips_person_id` values are currently null; they will be correct after the sync fix

### 5. Update `.lovable/mips-api-reference.md`

Document the actual MIPS response shapes discovered via curl:
- Person create returns NO `data` field
- Photo must be uploaded separately (multipart)
- `validTimeBegin`/`validTimeEnd` control access windows
- `deptId: 100` = Member, `101` = Employee
- Full person fields discovered

## Files to Modify

| File | Change |
|---|---|
| `supabase/functions/sync-to-mips/index.ts` | Full rewrite: upsert logic, personId lookup, validity dates, separate photo upload |
| `supabase/functions/mips-proxy/index.ts` | Add multipart photo upload mode |
| `src/services/mipsService.ts` | Fix interfaces, add `fetchPersonBySn()` |
| `.lovable/mips-api-reference.md` | Update with real response shapes |

## Testing Strategy

Before deploying, curl test each step:
1. Check if a person exists by `personSn`
2. Create new person → verify in list
3. Update existing person via PUT → verify
4. Test multipart photo upload endpoint discovery
5. Dispatch to device 13 with correct `personId`
6. Verify photo appears in MIPS person detail

## Attendance Flow (how it works end-to-end)

```text
Device face scan → MIPS middleware → POST to mips-webhook-receiver
  → Match personNo to member/employee via mips_person_id or member_code
  → If member: call member_check_in RPC (validates membership, records attendance)
  → If employee: insert/update staff_attendance (check-in/out toggle)
  → Log to access_logs table
  → Return {"result":1,"code":"000"} ACK
```

This flow is already implemented correctly in the webhook receiver. The only issue was that `mips_person_id` was stored as null (bug 1), so matching failed. Once sync stores the real `personId`, attendance will work automatically for members, staff, trainers, managers, and admins.

