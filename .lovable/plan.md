

# Fix MIPS Person Sync — Wrong Field Names & Missing Required Fields

## Root Cause (from curl testing & server logs)

I fetched the existing person (RAJAT LEKHARI) from MIPS and compared it against what our code sends. **Every field name is wrong and a required field is missing.**

### Existing MIPS person (confirmed via curl):
```json
{
  "personId": 1,
  "personSn": "1000",
  "personType": 1,
  "deptId": 100,
  "name": "RAJAT LEKHARI",
  "mobile": "9887601200",
  "email": "rajat.lekhari@hotmail.com",
  "gender": "M",
  "attendance": "1",
  "holiday": "1"
}
```

### What our code sends:
```json
{
  "personNo": "MAIN00001",     // WRONG — should be "personSn"
  "name": "Jessica Lekhari",   // OK
  "phone": "1234567890",       // WRONG — should be "mobile"
  "remark": "Gym Member"       // OK but not enough
}
```

### Missing required fields causing the NPE:
- **`personType`** (Integer) — `SysPerson.getPersonType()` is null → NPE. Must be `1`.
- **`deptId`** (Integer) — department, must be `100` (the "Member" department).

### False success detection (line 268):
```typescript
const success = createJson.code === 200 || createJson.code === 0 || createRes.ok;
//                                                                   ^^^^^^^^^^
// HTTP 200 even when MIPS returns {"code":500,"msg":"NPE..."} → success = true!
```
This is why the CRM marks everyone "synced" despite MIPS returning errors.

### Dispatch error:
Server log shows `{"deviceIds":[13],"params":{"dataScope":""},"tenantId":1}` — the `personId` is missing from logged params. The dispatch needs the MIPS-internal `personId` (integer like `1`), not the personSn string.

## Fix Plan

### 1. Fix `supabase/functions/sync-to-mips/index.ts`

**Person create payload** — use correct RuoYi field names:
```typescript
const personPayload = {
  personSn: mipsPersonNo,    // was: personNo
  personType: 1,             // REQUIRED - was: missing
  deptId: 100,               // REQUIRED - was: missing  
  name,
  mobile: phone,             // was: phone
  email,
  gender: "M",               // default
  attendance: "1",
  holiday: "1",
  remark: person_type === "member" ? "Gym Member" : "Staff",
};
```

**Photo field** — keep `personPhotoUrl` but also test if it needs to be raw base64 without data URI prefix.

**Success detection** — remove `createRes.ok`:
```typescript
const success = createJson.code === 200 || createJson.code === 0;
// Do NOT use createRes.ok — MIPS wraps errors in HTTP 200
```

**Dispatch payload** — use integer personId from create response:
```typescript
body: JSON.stringify({
  personId: createJson?.data?.personId || createJson?.data?.id,
  deviceIds: [TARGET_DEVICE_ID],
})
```

**Verify mode** — search by `personSn` not `personNo`:
```
?personSn=${stripped}&pageNum=1&pageSize=10
```
And match on `r.personSn === stripped`.

### 2. Fix `src/services/mipsService.ts`

Update `verifyPersonOnMIPS()` to match on `personSn` field instead of `personNo`.

### 3. Fix `src/components/devices/PersonnelSyncTab.tsx`

No structural changes needed — just ensure the sync status reflects actual MIPS success (which the edge function fix handles).

## Testing Strategy

After deploying the fix, I will:
1. Curl test person creation with the correct payload via `mips-proxy`
2. Verify the person appears in MIPS person list
3. Test dispatch to device 13
4. Confirm the full sync flow works end-to-end

## Files Modified

| File | Change |
|---|---|
| `supabase/functions/sync-to-mips/index.ts` | Fix field names, add required fields, fix success detection |
| `src/services/mipsService.ts` | Fix verify to use `personSn` |

