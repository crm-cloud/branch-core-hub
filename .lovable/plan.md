

# MIPS Middleware Integration & Device Management Redesign

## Architecture Overview

```text
┌─────────────────┐     ┌──────────────────────┐     ┌────────────────┐
│  Lovable App     │────>│  Supabase Edge Fns    │────>│  MIPS Server   │
│  (React UI)      │     │  sync-to-mips         │     │  212.38.94.228 │
│                  │     │  mips-webhook-receiver │<────│  :9000         │
│  Device Mgmt     │     │  mips-proxy (new)      │     │                │
│  Registration    │     └──────────────────────┘     └────────────────┘
└─────────────────┘                                    ┌────────────────┐
                                                       │  Face Terminal  │
                                                       │  (TCP to MIPS)  │
                                                       └────────────────┘
```

The device communicates with MIPS via TCP. MIPS exposes HTTP REST APIs. Our app pushes personnel data to MIPS and receives attendance callbacks from MIPS.

## MIPS API Summary (from docs)

- **Auth**: POST `http://212.38.94.228:9000/apiExternal/generateToken` with `identity=system&pStr=123456` (form-urlencoded). Returns JWT token.
- **Header**: All subsequent calls use `owl-auth-token: {token}` + `ContentType: application/x-www-form-urlencoded`
- **Devices**: GET `/admin/devices/page?page=1&size=20`
- **Employees**: GET `/admin/person/employees/page?page=1&size=20`
- **Pass Records**: GET `/admin/pass/pass_records/page?page=1&size=20`
- **Person object fields**: `name`, `personNo`, `photoUrl`, `idCard`, `expireTime`, `gender`

The Add Employee endpoint is not explicitly documented in the provided doc pages, but follows the MIPS REST convention. We will discover and validate it via the proxy edge function.

---

## Phase 1: Database Changes

### New columns on `profiles` table (via existing table)
No new tables needed. The existing `profiles`, `members`, `employees`, `trainers` tables already have `biometric_photo_url`. We add:

- `members.mips_person_id` (text, nullable) -- the MIPS-side person ID
- `members.mips_sync_status` (text, default 'pending') -- 'pending' / 'synced' / 'failed'
- `employees.mips_person_id` (text, nullable)
- `employees.mips_sync_status` (text, default 'pending')

### Migration SQL
```sql
ALTER TABLE public.members 
  ADD COLUMN IF NOT EXISTS mips_person_id text,
  ADD COLUMN IF NOT EXISTS mips_sync_status text DEFAULT 'pending';

ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS mips_person_id text,
  ADD COLUMN IF NOT EXISTS mips_sync_status text DEFAULT 'pending';
```

---

## Phase 2: Edge Functions

### 1. `mips-proxy` (new) -- Authenticated proxy to MIPS REST API
Since the MIPS server is on a VPS and the browser can't call it directly (CORS), we create a proxy edge function that:
- Authenticates to MIPS using `generateToken`
- Caches the token (tokens are JWT, long-lived)
- Proxies requests to any MIPS endpoint
- Used by both other edge functions and the frontend (via `supabase.functions.invoke`)

**Secrets needed**: `MIPS_SERVER_URL`, `MIPS_USERNAME`, `MIPS_PASSWORD`

### 2. `sync-to-mips` (new) -- Push personnel to MIPS
- Called from frontend after member/staff registration or photo upload
- Fetches person data from Supabase
- Downloads photo from storage, compresses to base64
- Calls MIPS API to add/update the employee
- Updates `mips_sync_status` to 'synced' or 'failed'
- Updates `mips_person_id` with the MIPS-assigned ID

### 3. `mips-webhook-receiver` (new) -- Receive attendance from MIPS
- MIPS sends pass records as HTTP POST to this URL
- Parses the MIPS callback payload (fields: `personNo`, `passType`, `time`, `temperature`, `imgUri`, `deviceName`, `passPersonType`)
- Looks up member/staff by `mips_person_id` or `personNo`
- Calls `member_check_in` RPC or inserts `staff_attendance`
- Inserts into `access_logs`
- Returns `{"code": 200, "msg": "Successful!"}` immediately

**Webhook URL to configure in MIPS**: `https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/mips-webhook-receiver`

---

## Phase 3: Device Management UI Redesign

Complete rewrite of `src/pages/DeviceManagement.tsx` with 5 tabs:

### Tab 1: Dashboard
- Stats from MIPS API (device count, online/offline, total persons, total faces)
- Stats from Supabase (enrolled members, pending sync)
- Live connection status to MIPS server (green/red indicator)

### Tab 2: Devices (from MIPS)
- Fetches device list from MIPS via `mips-proxy`
- Shows: deviceKey, name, personCount, faceCount, IP, online status, last active
- Actions: Remote Open, Restart, Set Time, Download Staff
- Maps to our local `access_devices` records

### Tab 3: Personnel Sync
- Shows all members/staff with sync status columns:
  - Name, Role, Has Photo, MIPS Synced, MIPS Person ID
- "Sync to MIPS" button per person or bulk sync
- "Sync All" button for the entire branch
- Filter: Synced / Pending / Failed

### Tab 4: Live Feed
- Existing `LiveAccessLog` component (reads `access_logs`)
- Now also shows MIPS pass records fetched via proxy
- Realtime updates from both sources

### Tab 5: Debug (admin only)
- Test MIPS connection (generate token)
- View raw MIPS device list
- View raw MIPS pass records
- E2E test checklist
- Log purge utility

### New Components
- `src/components/devices/MIPSDeviceCard.tsx` -- device card with MIPS data
- `src/components/devices/PersonnelSyncTab.tsx` -- sync status view
- `src/components/devices/MIPSDashboard.tsx` -- MIPS stats dashboard
- `src/components/devices/BiometricCapture.tsx` -- webcam face capture component

---

## Phase 4: Registration Flow with Face Capture

### BiometricCapture Component
- Requests camera permission via `navigator.mediaDevices.getUserMedia`
- Shows live video feed with square face overlay guide
- Capture button snaps photo
- Auto-crops to square, compresses to JPEG under 300KB using existing `imageCompression.ts`
- Strips data URL prefix, returns raw base64
- Used in:
  - Member registration (`AddMemberDrawer`)
  - Member profile (`MemberProfileDrawer` hardware tab)
  - Staff registration (`AddEmployeeDrawer`)

### Registration Workflow
1. Staff fills in member details + captures face photo
2. Photo uploaded to Supabase storage (`member-photos` bucket)
3. `sync-to-mips` edge function called to push to MIPS
4. MIPS assigns person ID, syncs face to all connected terminals
5. UI shows sync status: Queued -> Syncing -> Synced

---

## Phase 5: Inbound Webhook (Attendance)

### MIPS Callback Payload (from pass records API)
```json
{
  "personNo": "520520",
  "personName": "John",
  "passType": "face_0",
  "passPersonType": "Employee",
  "temperature": "36.1",
  "temperatureState": 1,
  "maskState": 1,
  "imgUri": "/u/cms/www/...",
  "deviceName": "Entry Terminal",
  "createTime": "2024-10-12 17:06:38"
}
```

### Processing Logic
1. Parse incoming payload
2. Match `personNo` to `members.mips_person_id` or `employees.mips_person_id`
3. If member: call `member_check_in` RPC
4. If staff: toggle check-in/check-out (existing logic)
5. If stranger: log with `result: 'stranger'`
6. Insert into `access_logs` with full payload
7. Return `200` immediately

---

## Files to Create/Modify

| File | Action |
|------|--------|
| Migration | Add `mips_person_id`, `mips_sync_status` to members/employees |
| `supabase/functions/mips-proxy/index.ts` | NEW - Authenticated proxy to MIPS |
| `supabase/functions/sync-to-mips/index.ts` | NEW - Push personnel to MIPS |
| `supabase/functions/mips-webhook-receiver/index.ts` | NEW - Receive attendance |
| `src/pages/DeviceManagement.tsx` | REWRITE - 5-tab command center |
| `src/components/devices/MIPSDashboard.tsx` | NEW - MIPS stats |
| `src/components/devices/PersonnelSyncTab.tsx` | NEW - Sync status view |
| `src/components/devices/BiometricCapture.tsx` | NEW - Webcam face capture |
| `src/services/mipsService.ts` | NEW - Frontend service for MIPS proxy calls |
| `src/services/deviceService.ts` | UPDATE - Add MIPS integration methods |

## Execution Order
1. Add secrets (`MIPS_SERVER_URL`, `MIPS_USERNAME`, `MIPS_PASSWORD`)
2. Database migration (add MIPS columns)
3. Create `mips-proxy` edge function and test token generation
4. Create `sync-to-mips` edge function
5. Create `mips-webhook-receiver` edge function
6. Build `BiometricCapture` component
7. Build `PersonnelSyncTab` component
8. Redesign `DeviceManagement.tsx` with all 5 tabs
9. End-to-end test: register person -> sync to MIPS -> verify on MIPS dashboard

## Important Notes
- The existing `terminal-heartbeat`, `terminal-identify`, `terminal-register` edge functions remain as-is for direct device callbacks. The new MIPS integration is a **parallel path** that works through the middleware server.
- The MIPS server at `212.38.94.228:9000` is the **authoritative source** for device management. Our app syncs personnel TO it and receives attendance FROM it.
- The cloud screenshot shows the device config: IP `212.38.94.228`, Port `10011`, Key `D1146D682A96B1C2`, Protocol `TCP`. This confirms the device connects to MIPS via TCP, not directly to our Supabase endpoints.

