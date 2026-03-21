

# Device Integration Redesign: Stock ZKTeco Terminal ↔ Incline Cloud

## The Core Problem

Your terminal runs **stock ZKTeco firmware (v1.42.0.2)**. The current codebase assumes a **custom Android APK** will call the `terminal-sync` endpoint — but no such APK exists. The stock firmware uses the **ICLOCK/PUSH protocol**, where the device POSTs attendance data to a configured server URL.

## How Stock ZKTeco Terminals Work

```text
┌─────────────────┐         PUSH (every 30s)        ┌──────────────────┐
│  ZKTeco Terminal │ ──── POST /iclock/cdata ──────► │  Incline Cloud   │
│  (stock firmware)│ ◄─── Response with commands ─── │  (edge function) │
│  SN: 01MA10      │                                  │  /terminal-sync  │
└─────────────────┘                                  └──────────────────┘

The device:
1. POSTs to Server URL/iclock/cdata?SN=01MA10&...  (heartbeat + push data)
2. POSTs attendance records as tab-separated lines
3. Expects specific response format: "OK" or commands like "C:ID:DATA"
```

The terminal's **"App Settings" → "Server URL"** needs your edge function URL. But the current `terminal-sync` edge function expects JSON, not the ICLOCK protocol format.

## What Needs to Change

### 1. New Edge Function: `terminal-iclock` (the ZKTeco protocol handler)

A new edge function that speaks the ICLOCK/PUSH protocol natively:

- **`GET /iclock/cdata?SN=xxx`** — Device handshake. Returns `OK` + push parameters.
- **`POST /iclock/cdata?SN=xxx&table=ATTLOG`** — Device pushes attendance events (face scan, card tap). Each line: `PIN\tTimestamp\tVerifyMode\tInOutMode\tWorkCode`. Parse and route through the existing `validate_member_checkin` → `member_check_in` flow.
- **`GET /iclock/getrequest?SN=xxx`** — Device polls for pending commands. Return roster sync commands (`DATA UPDATE USERINFO`) to push member photos/names to the device.
- **`POST /iclock/devicecmd?SN=xxx`** — Device confirms command execution.

This replaces the need for a custom APK entirely.

### 2. Roster Push (Cloud → Device)

Stock terminals accept user enrollment via the ICLOCK protocol:

```text
C:1:DATA UPDATE USERINFO PIN=member_uuid\tName=John\tPri=0
C:2:DATA UPDATE BIODATA PIN=member_uuid\tNo=0\tIndex=0\tValid=1\tDuress=0\tType=9\tTmp=<base64_face_template>
```

When you add a member photo via the web app, the system queues a sync command. On the next device poll (`getrequest`), the command is delivered and the terminal enrolls the face locally.

### 3. Redesign Device Management UI

The current UI is missing critical "what to type into the terminal" information:

- **Add a "Device Setup Card"** per device that shows:
  - **Server URL to enter on terminal**: `https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/terminal-iclock`
  - **Device SN**: Show the registered SN with a note "This must match the terminal's SN in App Settings"
  - **Connection Status**: Real-time heartbeat indicator
  - **Roster Sync Status**: How many members are synced to this device
- **Replace the generic "Terminal Setup Guide"** with stock-firmware-specific steps:
  1. On terminal → System Settings → App Settings
  2. Set Server URL to the displayed URL
  3. Set Push Interval to 30 seconds
  4. Enable "Realtime Push"
  5. Verify connection goes green

### 4. Fix Device SN Mismatch

The registered device has SN `D1146D682A96B1C2` but the terminal header shows `01MA10`. Need to update the DB record or clarify which SN the device actually reports. Add a "Test Connection" button that sends a test heartbeat and shows whether the SN matches.

### 5. Member Photo Enrollment Flow

Currently all 5 members have `biometric_photo_url: null`. The enrollment flow needs:

- **Web Upload**: Admin uploads member photo → stored in `member-photos` bucket → URL saved to `biometric_photo_url` → queued for device sync via ICLOCK `DATA UPDATE BIODATA` command
- **Terminal Capture**: Device captures face locally → reports enrollment via `ATTLOG` → cloud marks `biometric_enrolled = true`

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/terminal-iclock/index.ts` | **New** — ZKTeco ICLOCK protocol handler |
| `supabase/config.toml` | Add `[functions.terminal-iclock]` with `verify_jwt = false` |
| `src/pages/DeviceManagement.tsx` | Redesign setup guide for stock firmware, add per-device setup card |
| `src/components/devices/AddDeviceDrawer.tsx` | Add protocol type selector (ICLOCK vs Custom APK) |
| `src/components/devices/DeviceSetupCard.tsx` | **New** — Shows exact terminal configuration values |

## Execution Order

1. Create `terminal-iclock` edge function (ICLOCK protocol)
2. Add config.toml entry
3. Redesign Device Management UI with stock firmware setup guide
4. Add per-device setup card with copyable Server URL and SN
5. Wire member photo enrollment to device sync queue

## Important Note

Before building, you need to verify the exact SN format your terminal reports. On the terminal:
- Go to **App Settings** → look for "Device Serial Number" or "SN"
- The `01MA10` shown in the top bar may be a device alias, not the SN
- The actual SN may be `D1146D682A96B1C2` (which you already registered)

The Server URL to enter in the terminal will be: `https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/terminal-iclock`

