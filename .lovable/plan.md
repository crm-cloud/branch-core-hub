

# Deep Audit: MIPS Attendance Processing, Person Lookup, and Attendance Architecture

## Audit Findings

### Critical Bug 1: Person lookup fails for employees/trainers — `personId` vs `personSn` mismatch

The real device payload (from edge function logs) sends:
```json
{
  "personId": "EMPMM3FYN8U",
  "personName": "MANAGER",
  "type": "face_0",
  "time": "1774594588284",
  "deviceKey": "D1146D682A96B1C2"
}
```

The device sends `personId` = `"EMPMM3FYN8U"` (the personSn/code used during sync). But in our database, the employee `EMP-MM3FYN8U` has `mips_person_id = "21"` (the numeric MIPS ID). The webhook's `findPersonByMipsId()` checks `mips_person_id = "EMPMM3FYN8U"` → no match against `"21"`.

Then `findPersonByCode()` generates candidates `["EMPMM3FYN8U", "EMP-MM3FYN8U"]` and checks `employee_code`. The DB has `employee_code = "EMP-MM3FYN8U"` — this **should** match. But the log shows "Person not found in CRM" without the `findPersonByCode` warning firing, which strongly suggests the **deployed code is stale** (an older version without the EMP normalization logic).

**Fix**: Redeploy `mips-webhook-receiver` AND also store the `personSn` (code sent to MIPS) separately in the CRM so lookups can match by either numeric ID or code.

### Critical Bug 2: `captured_at` timestamp insertion fails

Error: `date/time field value out of range: "1774594588284"`

The device sends `time: "1774594588284"` (Unix ms). The `normalizeScanTime()` function in the current code should convert this to ISO format, but the error shows the raw number being inserted — confirming the deployed version is outdated and doesn't have `normalizeScanTime`. The access_log row was never created because this insert failed.

**Fix**: Redeploy the edge function to get the latest `normalizeScanTime` code.

### Critical Bug 3: Result incorrectly set to "member" even when person not found

When `faceTypeInfo` = `{result: "member", description: "Authorized face scan"}` (from `face_0` type), and the person lookup fails, the code still uses these defaults. The access_log says "member" even though no person was found and no attendance was recorded.

**Fix**: After person lookup fails, override result to `"not_found"` and message to `"Person {personNo} not found in CRM"`.

### Bug 4: Trainers have no `trainer_code` column

The `trainers` table has NO `trainer_code` column. The webhook `findPersonByCode()` only checks `members.member_code` and `employees.employee_code` — it never searches trainers by code. Trainers can only be matched by `mips_person_id`. If the device sends the trainer's personSn (e.g., `TRN5096`), the lookup fails.

**Fix**: Add trainer code lookup to `findPersonByCode()` — since trainers don't have a code column, derive it the same way sync does (`TRN{shortId}`) or check against `mips_person_id` which stores the personSn if sync used it. Actually, trainer `5096f7aa` has `mips_person_id = "22"` (numeric), so the device would send `personId = "TRN5096"` which wouldn't match `"22"`. Need to also store the personSn used during sync.

### Attendance Processing Architecture (All Roles)

```text
┌──────────────┐     ┌────────────────────┐     ┌────────────────────┐
│ Face Terminal │────▶│ mips-webhook-       │────▶│ Database           │
│ (Hardware)    │     │ receiver            │     │                    │
└──────────────┘     │                     │     │ access_logs        │
                     │ 1. Parse payload    │     │ member_attendance  │
                     │ 2. Lookup person    │     │ staff_attendance   │
                     │ 3. Route by type:   │     └────────────────────┘
                     │   member → RPC      │
                     │   employee → toggle │
                     │   trainer → toggle  │
                     │ 4. Log + relay      │
                     └────────────────────┘
```

**Member attendance**: Uses `member_check_in` RPC which validates membership, checks for existing open sessions, and inserts into `member_attendance` with `check_in_method: "biometric"`.

**Staff/Trainer attendance**: Uses check-in/check-out toggle in `staff_attendance` table via `user_id`. First scan = check-in, second scan = check-out (if same day with open session).

**HRM/Payroll integration**: `calculatePayrollForStaff()` queries `staff_attendance` by `user_id` for the month → counts `daysPresent` → calculates `proRatedPay = (baseSalary / calendarDays) × daysPresent`. Trainer PT commissions are added on top.

**My Attendance (member)**: `MyAttendance.tsx` queries `member_attendance` by `member_id` for the selected month.

### Issue: No attendance data flows because person lookup fails

Since EMPMM3FYN8U (MANAGER) was not found, no `staff_attendance` row was created. No `access_log` was created either (timestamp error). This means:
- HRM payroll shows 0 days present for biometric scans
- Attendance dashboard shows no biometric entries
- Staff attendance page is empty for biometric events

## Implementation Plan

### Step 1: Fix person lookup in webhook (Critical)

In `supabase/functions/mips-webhook-receiver/index.ts`:
- Add a new lookup field: the device sends `personId` which is the `personSn` (code) used during sync. Store this as `mips_person_sn` or search by matching the hyphen-stripped code patterns.
- Fix `findPersonByCode()` to also check trainers — derive trainer lookup candidates (e.g., `TRN{x}` patterns).
- When person not found, set `result = "not_found"` instead of keeping `"member"` from face_type.
- **Redeploy** the edge function to ensure `normalizeScanTime` is active.

### Step 2: Fix timestamp handling (Critical)

The `normalizeScanTime` function exists in the code but needs redeployment. Verify after deploy that `1774594588284` correctly converts to `2026-03-27T06:56:28.284Z`.

### Step 3: Add `mips_person_sn` column to members/employees/trainers

During sync, the edge function `sync-to-mips` sends `personSn` = hyphen-stripped code (e.g., `EMPMM3FYN8U`). Store this value in a new `mips_person_sn` column so the webhook can match incoming `personId` directly without guessing normalization.

**Migration:**
```sql
ALTER TABLE members ADD COLUMN IF NOT EXISTS mips_person_sn text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS mips_person_sn text;
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS mips_person_sn text;
```

Update `sync-to-mips` to write `mips_person_sn` after successful sync.
Update `findPersonByMipsId` to also check `mips_person_sn`.

### Step 4: Update API documentation

Update `.lovable/mips-api-reference.md` AND `README.md` with:
- Actual device payload format (uses `personId` not `personNo`)
- Person lookup chain: `mips_person_id` → `mips_person_sn` → code normalization
- Attendance flow per role (member RPC vs staff toggle)
- HRM/payroll dependency on `staff_attendance`
- Timestamp formats from device (Unix ms in `time` field)
- All edge function endpoints with their purposes
- Hardware API docs summary (relay, Wiegand, GPIO from uploaded PDFs)

### Step 5: Redeploy webhook

Force redeploy `mips-webhook-receiver` to ensure latest code (with `normalizeScanTime`, EMP normalization, etc.) is live.

## Files to Modify

| File | Change |
|---|---|
| `supabase/functions/mips-webhook-receiver/index.ts` | Fix result when person not found; add `mips_person_sn` lookup; add trainer code lookup |
| `supabase/functions/sync-to-mips/index.ts` | Write `mips_person_sn` after successful sync |
| `.lovable/mips-api-reference.md` | Full documentation update with actual payload format, attendance flow, HRM integration |
| `README.md` | Add MIPS integration section with all endpoints |
| **Migration** | Add `mips_person_sn` column to members, employees, trainers |

## Attendance Architecture Summary (For Reference)

| Role | Table | Key Field | Check-in Method | Used By |
|---|---|---|---|---|
| Member | `member_attendance` | `member_id` | `member_check_in` RPC (validates membership) | My Attendance, Attendance Dashboard, Analytics |
| Employee | `staff_attendance` | `user_id` | Direct insert (toggle check-in/out) | HRM Payroll, Staff Attendance page |
| Trainer | `staff_attendance` | `user_id` | Direct insert (toggle check-in/out) | HRM Payroll, Staff Attendance page, Trainer Earnings |
| Admin/Manager | `staff_attendance` | `user_id` | Direct insert (toggle check-in/out) | HRM Payroll, Staff Attendance page |

**Payroll formula**: `Net = (Base Salary / Calendar Days × Days Present) + PT Commissions − 12% PF`

