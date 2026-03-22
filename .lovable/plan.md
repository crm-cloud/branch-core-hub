

# Deep Audit Results & Device Integration Fix Plan

## Live Audit Findings

### What's Working
- Device `D1146D682A96B1C2` is **online and sending heartbeats** every ~30s
- `hardware_devices` table is receiving upserts correctly
- `access_logs` is recording identify events
- The 3 edge functions are deployed, reachable, and responding with `{"code": 0}`

### What's Broken

**1. Roster Pull Returns Empty — Members Never Sync to Device**
The `terminal-register` roster pull (`action=pull_members`) returns `{"members": []}` even though 5 active members exist with `hardware_access_enabled = true`. 

**Root cause**: The roster query filters by `biometric_photo_url IS NOT NULL`, but ALL 5 members have `biometric_photo_url = null`. The roster should include members **without photos** too — the device can capture their face locally. Members need at minimum their `personId` (UUID) and `name` so the device can enroll them.

**2. No Membership Expiry in Roster**
The `terminal-register` roster does not include membership `end_date`. Without this, the device has no way to block expired members. The device APK typically uses an expiry field to auto-deny access after the date passes.

**3. Staff/Trainers Not in Roster**
The roster only returns members. Staff (`TESTSTAFF`, `MANAGER`) and trainers (`Trainer`) are not included. They need terminal access too.

**4. Stranger Scans Not Handled Properly**
The device sends `personId: "STRANGERBABY"` for unrecognized faces (15+ events logged). The `terminal-identify` function treats this as a real identifier and queries the DB for it. It should detect the `STRANGERBABY` sentinel value and log it as a stranger event without querying members/staff.

**5. No Refresh Button in UI**
Device list and access logs have no manual refresh button. The user must reload the entire page to see updated heartbeat status.

**6. No Access Log Viewer for `access_logs` Table**
The `LiveAccessLog` component reads from `device_access_events` (legacy table), not the new `access_logs` table where the terminal actually writes data. So the live feed shows nothing.

**7. No Payload Inspector**
No way to view raw payloads from the device in the UI. This is critical for debugging what the device actually sends.

### Device Payload Schema (Captured Live)

```text
Field           Example              Purpose
─────────────── ──────────────────── ─────────────────────────
deviceKey       D1146D682A96B1C2     Device serial number
personId        STRANGERBABY / UUID  Person identifier
personName      John Doe             Enrolled name
type            face_2               Recognition type
direction       0                    Entry/Exit (0=entry)
time            1774030868292        Unix timestamp (ms)
ip              10.0.1.211           Device IP
livenessScore   (number)             Anti-spoofing score
mask             (string)            Mask detection
searchScore     (number)             Face match confidence
imgBase64       /9j/4AAQ...          Captured face image
path            (string)             Image path on device
```

## Fix Plan

### Step 1: Fix Roster to Include All Personnel (With and Without Photos)

**File**: `supabase/functions/terminal-register/index.ts`

- Remove the `biometric_photo_url IS NOT NULL` filter — send members even without photos
- Add `expiryDate` field from the `memberships` table (latest active membership `end_date`)
- Add staff and trainers to the roster response alongside members
- Each person gets: `personId`, `name`, `imageUrl` (nullable), `expiryDate`, `role` (member/staff/trainer)

### Step 2: Handle Stranger Detection in Identify

**File**: `supabase/functions/terminal-identify/index.ts`

- Detect `STRANGERBABY` and other sentinel values (`STRANGER`, `stranger`, etc.)
- Log as `result: 'stranger'` in `access_logs` with the `imgBase64` saved
- Skip all member/staff lookups for strangers
- Still return `{"code": 0}` to the device

### Step 3: Fix Live Access Log to Read from `access_logs`

**File**: `src/components/devices/LiveAccessLog.tsx`

- Switch from `device_access_events` to `access_logs` table
- Show: timestamp, device SN, event type, result, person name/ID, message
- Add realtime subscription on `access_logs` for live updates
- Add color coding: green for member/staff, red for not_found/stranger, yellow for denied

### Step 4: Add Refresh Button & Payload Inspector to Device Management

**File**: `src/pages/DeviceManagement.tsx`

- Add a refresh button to the device list header that invalidates queries
- Add a "Recent Payloads" section showing the last 10 `access_logs` entries with expandable raw payload view
- Add a "Test Connection" button per device that calls `terminal-heartbeat` with the device SN via curl

### Step 5: Add Realtime Publication for `access_logs`

**Migration**: Enable realtime for `access_logs` table so the LiveAccessLog component can subscribe to live events.

### About Edge Function Deployment
Edge functions deploy **automatically** when code changes are saved — no manual deployment step is needed. The changes to `terminal-register` and `terminal-identify` will be live as soon as the code is updated.

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/terminal-register/index.ts` | Include all members (with/without photo), add expiry date, add staff/trainers |
| `supabase/functions/terminal-identify/index.ts` | Add stranger detection, skip DB lookups for sentinel IDs |
| `src/components/devices/LiveAccessLog.tsx` | Switch to `access_logs` table, add realtime subscription |
| `src/pages/DeviceManagement.tsx` | Add refresh button, payload inspector, fix queries |
| Migration | Enable realtime on `access_logs` |

## Execution Order
1. Fix roster pull (critical — enables member sync to device)
2. Fix stranger detection in identify
3. Enable realtime on `access_logs`
4. Rebuild LiveAccessLog component
5. Add refresh + payload inspector to Device Management UI

