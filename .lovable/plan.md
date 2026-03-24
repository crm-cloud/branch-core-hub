

# Fix sync-to-mips + Dashboard Cleanup + Live Heartbeat Monitor

## Problems Identified

### 1. sync-to-mips 500 Error (Critical)
Edge function logs reveal two bugs:
- **Stack overflow**: `btoa(String.fromCharCode(...new Uint8Array(imgBuffer)))` uses the spread operator on potentially large arrays (photos), causing `Maximum call stack size exceeded`. Must chunk the conversion.
- **HTML response parsed as JSON**: The MIPS `/admin/person/employees/save` endpoint is returning an HTML page (likely a 404 or redirect), meaning the endpoint path is wrong. Need to discover the correct add-person endpoint and handle non-JSON responses gracefully.

### 2. Dashboard Still Shows Legacy "Local (Supabase)" Card
The screenshot shows "Local (Supabase) 1 devices / 0 online / 1 offline" alongside "MIPS Server 1 devices". This was supposed to be removed in the last refactor but is still visible. The `MIPSDashboard.tsx` code I just read does NOT contain this card — so it may be rendered elsewhere or cached. Need to verify and remove any remaining legacy comparison UI.

### 3. No Live Heartbeat Pulse or Offline Notifications
The "Online 1/1" stat is static. Requirements:
- Animated heartbeat pulse that polls MIPS every 15 seconds
- Push notification to admin/manager when a device goes offline

---

## Plan

### Fix 1: sync-to-mips Edge Function
- Replace `btoa(String.fromCharCode(...new Uint8Array(imgBuffer)))` with a chunked base64 encoder to avoid stack overflow
- Add response content-type check before `res.json()` — if HTML is returned, log the raw text and throw a descriptive error
- Try alternate MIPS endpoints: `/admin/person/employees/save`, `/api/person/add`, `/admin/person/employees/add` — or send as JSON with `Content-Type: application/json` instead of form-urlencoded (MIPS may expect JSON for the photo payload)

### Fix 2: Remove Legacy Local Stats
- Verify no other component renders the "Local (Supabase)" card. If `MIPSDashboard.tsx` is clean (it is), check if there's a cached build or if a `DeviceSetupCard` import still exists somewhere
- Confirm deletion is complete

### Fix 3: Live Heartbeat Monitor in Dashboard
- Add `refetchInterval: 15000` to the MIPS devices query so it auto-polls every 15 seconds
- Add an animated heartbeat dot (CSS pulse animation) on the Online stat card that pulses each time the query refreshes
- Track previous device statuses in a `useRef` — when a device transitions from online to offline, insert a notification into the `notifications` table targeting admin/manager roles
- Show "Last checked: X seconds ago" timestamp below the connection status

### Fix 4: Offline Alert Notification
- When the MIPS connection test or device poll detects a device went offline (was online last poll, now offline), call a Supabase insert into `notifications` table for admin/owner roles with message like "Device {name} went offline"

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/sync-to-mips/index.ts` | Fix base64 chunking, fix endpoint path, handle HTML responses |
| `src/components/devices/MIPSDashboard.tsx` | Add refetchInterval polling, animated heartbeat, last-checked timestamp, offline detection + notification |
| `src/services/mipsService.ts` | No changes needed |

