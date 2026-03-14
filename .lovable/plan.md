

# Terminal Gateway + SN-Based Device Communication + Setup Guide

## SDK Deep Comprehension Summary

From the SMDT SDK docs, the Android terminal uses:
- **`setRelayIoMode(mode, delay)`** — mode 0=manual, 1=auto-close (high-effective), delay in seconds (max 63s)
- **`setRelayIoValue(value)`** — 0=close relay, 1=open relay. In auto-close mode, calling this opens then auto-closes.
- **`smdtSendCard(idCard, format)`** — Wiegand output (26-bit or 34-bit)
- **`smdtReadWiegandData()`** — Blocking Wiegand input reader (runs in a background thread)
- **`setLedLighted(color, on/off)`** — LED control: WHITE, RED, GREEN
- **`smdtGetCameraVidPid(cameraId)`** — Camera identification

The APK handles face recognition locally. It needs a **Server URL** to POST events to. Our edge functions must accept the APK's payload format.

---

## Current Problems

1. **All edge functions use `device_id` (UUID)** — The APK only knows its Serial Number (SN), not the Supabase UUID. Every endpoint must support SN-based device lookup.
2. **No unified `terminal-sync` endpoint** — The APK needs a single URL to POST access events, heartbeats, and receive commands.
3. **No setup guide in the UI** — Admins have no instructions on how to configure the APK.
4. **Heartbeat overwrites `config`** with `status` payload — Should merge, not replace.

---

## Plan

### 1. Create `terminal-sync` Edge Function (New)

A single endpoint the APK calls. It accepts a `type` field to route:

| `type` | Action |
|--------|--------|
| `heartbeat` | Update `last_heartbeat`, `is_online`, auto-detect IP. Return pending commands. |
| `access_event` | Face recognized → validate member → return OPEN/DENIED + relay instructions. |
| `sync_request` | Device asks for member roster (full or incremental). |

**Device lookup**: All requests include `device_sn` (serial number). The function queries `access_devices` by `serial_number` instead of `id`.

**Response format** (for `access_event`):
```json
{
  "action": "OPEN",
  "relay_mode": 1,
  "relay_delay": 5,
  "led_color": "GREEN",
  "person_name": "Rahul Sharma",
  "message": "Welcome back!",
  "member_code": "INC-00001"
}
```
This tells the APK exactly what SDK calls to make: `setRelayIoMode(1, 5)`, `setRelayIoValue(1)`, `setLedLighted("GREEN", true)`.

### 2. Update Existing Edge Functions for SN Lookup

Update `device-heartbeat`, `device-access-event`, `device-sync-data`, `device-sync-callback` to support **both** `device_id` (UUID) and `device_sn` (serial number) as identifiers. If `device_sn` is provided, look up by `serial_number` column first.

### 3. Add Setup Guide to Device Management UI

Add a new **"Terminal Setup Guide"** collapsible card in `DeviceManagement.tsx` with step-by-step instructions:
1. Install the APK on the Android terminal
2. Open Settings in the APK
3. Set **Server URL** to the `terminal-sync` endpoint
4. Set **Device SN** to match the serial number registered in the system
5. Test connection (heartbeat should turn green)

Include copyable endpoint URLs and a sample JSON payload for testing with `curl`.

### 4. Add Pending Commands Response to Heartbeat

When the device sends a heartbeat, check `device_commands` table for pending commands (e.g., `relay_open`). Return them in the heartbeat response so the APK can execute `setRelayIoValue(1)` locally. Mark commands as `executed` after returning.

---

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/terminal-sync/index.ts` | **New** — Unified endpoint accepting `{ type, device_sn, ... }`. Routes to heartbeat/access_event/sync logic. SN-based device lookup. |
| `supabase/config.toml` | Add `[functions.terminal-sync]` with `verify_jwt = false` |
| `supabase/functions/device-heartbeat/index.ts` | Add `device_sn` support — if provided, lookup by `serial_number`. Return pending `device_commands`. |
| `supabase/functions/device-access-event/index.ts` | Add `device_sn` support alongside `device_id`. |
| `src/pages/DeviceManagement.tsx` | Replace "Hardware API Endpoints" card with a comprehensive **"Terminal Setup Guide"** with step-by-step instructions, copyable URLs, sample payloads, and `curl` test commands. |

## Execution Order

1. Create `terminal-sync` edge function (the APK's single entry point)
2. Update existing edge functions for SN lookup
3. Add setup guide UI to Device Management page

