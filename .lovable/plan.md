

# Fix MIPS Sync: Trainers, Admins, Photo Upload, Validity, Attendance

## Problems Found

### 1. Trainers completely skipped
The `trainers` table has no `mips_sync_status` or `mips_person_id` columns. `PersonnelSyncTab` only queries `members` and `employees` — trainers are invisible.

### 2. Admins skipped
Admin/owner users who exist only in `user_roles` (not in the `employees` table) are never synced. They need device access too.

### 3. Photo upload endpoint is WRONG
Current code tries `/personInfo/person/importPhoto` — this fails. The real endpoint from the user's curl capture is:
```
POST /common/uploadHeadPhoto
Content-Type: multipart/form-data
Body: file=<jpeg>
```
The response returns a `fileName` path (e.g. `/userfiles/headPhoto/2026-03/image.jpeg`), then you PUT that path into the person's `photoUri` field.

### 4. Validity dates wrong for staff
Currently ALL person types get `validTimeBegin`/`validTimeEnd`. But only **members** need expiry dates (from membership). Staff/trainers/admins should have permanent access (far-future end date like `2099-12-31 23:59:59`) until deactivated.

### 5. Webhook receiver uses wrong columns
The `handleStaffCheckin` function uses `employee_id` and `date` columns, but the `staff_attendance` table actually has `user_id` and `check_in`/`check_out` (no `employee_id` or `date`). Staff attendance via webhook is broken.

Also, `findPersonByCode` for staff only checks `employees` table — trainers are missed. And trainers have no `mips_person_id` column to match on.

## Implementation Plan

### Step 1: Add `mips_sync_status` and `mips_person_id` to `trainers` table
Migration to add these two columns so trainers can be tracked for MIPS sync.

### Step 2: Rewrite `sync-to-mips/index.ts`
- Add `person_type: "trainer"` support — query `trainers` table
- For members: map `validTimeBegin`/`validTimeEnd` from membership dates
- For employees/trainers: set `validTimeEnd = "2099-12-31 23:59:59"` (permanent until deactivated)
- Fix photo upload: use `POST /common/uploadHeadPhoto` (multipart) to get the file path, then include `photoUri` in the PUT payload
- Generate a trainer code if none exists (use branch code + trainer ID prefix)

### Step 3: Rewrite `PersonnelSyncTab.tsx`
- Add trainers query alongside members and employees
- Show type badge: Member / Staff / Trainer
- Trainers use `type: "trainer"` when calling sync

### Step 4: Fix `mips-webhook-receiver/index.ts`
- Fix `handleStaffCheckin`: use `user_id` (not `employee_id`), `check_in`/`check_out` (not `date`)
- Add trainer lookup in `findPersonByMipsId` and `findPersonByCode` — check `trainers` table too
- When a trainer is identified, treat same as staff for attendance (insert into `staff_attendance` using `user_id`)

### Step 5: Update `mipsService.ts`
- Add trainer support in verification functions

### Step 6: Update `.lovable/mips-api-reference.md`
- Document the real photo upload endpoint: `POST /common/uploadHeadPhoto`
- Document the two-step photo flow: upload → get path → PUT photoUri on person

## Files Modified

| File | Change |
|---|---|
| Migration SQL | Add `mips_sync_status`, `mips_person_id` to `trainers` |
| `supabase/functions/sync-to-mips/index.ts` | Add trainer support, fix photo upload endpoint, fix validity dates |
| `supabase/functions/mips-webhook-receiver/index.ts` | Fix staff_attendance columns, add trainer lookup |
| `src/components/devices/PersonnelSyncTab.tsx` | Add trainers to personnel list |
| `src/services/mipsService.ts` | Minor: trainer support in verify |
| `.lovable/mips-api-reference.md` | Document real photo upload flow |

## Photo Upload Flow (from user's curl)
```
1. POST /common/uploadHeadPhoto  (multipart, field: "file")
   → Response: { "code": 200, "fileName": "/userfiles/headPhoto/2026-03/photo.jpeg" }

2. PUT /personInfo/person  (JSON)
   → Body: { "personId": 17, "photoUri": "/userfiles/headPhoto/2026-03/photo.jpeg", ... }
```

## Validity Rules
- **Members**: `validTimeBegin` = membership start, `validTimeEnd` = membership end
- **Employees/Trainers/Admins**: `validTimeBegin` = today, `validTimeEnd` = `2099-12-31 23:59:59` (permanent)
- When deactivated (`is_active = false`), the person should be removed from device or validity set to past date

