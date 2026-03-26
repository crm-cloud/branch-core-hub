

# Deep Audit: Webhook Not Receiving + API Documentation Update + Dynamic Server Config

## Root Cause: Why No Webhook Logs

**Zero logs in `mips-webhook-receiver`** — the device is NOT sending data to our endpoint. Three likely causes:

### Cause 1: Callback URL not actually saved in MIPS
The MIPS admin panel requires clicking **OK/Save** after pasting the URL in the "Server Configuration" dialog. If the dialog was closed without saving, the device still points to the old loopback URL (`http://212.38.94.228:9000/api/callback/identify`).

### Cause 2: MIPS callback URL path mismatch
The uploaded manual (Page 9) reveals the actual callback paths for this MIPS version:
- **Recognition Record Upload URL**: `http://192.168.1.115:9000/tdx-admin/api/callback/identity` (note: `identity` not `identify`, and prefixed with `/tdx-admin`)
- **Device Heartbeat Upload URL**: `http://192.168.1.115:9000/tdx-admin/api/callback/heartbeat`
- **Register Person Data Upload URL**: (same prefix pattern)

The relay forwarding in our webhook currently sends to `/api/callback/identify` which may be wrong. The correct internal relay path depends on the MIPS version but is likely `/api/callback/identify` or `/tdx-admin/api/callback/identity` for v3.

### Cause 3: HTTPS/TLS handshake failure
The device firmware may not support HTTPS/TLS connections to external URLs. Supabase edge functions are HTTPS-only. If the device can only POST to HTTP endpoints, it physically cannot reach our webhook. **This is the most probable cause.**

**Solution for Cause 3**: The MIPS middleware acts as the relay. Configure the MIPS middleware itself (not the device) to forward callbacks to our webhook. The device sends to MIPS (HTTP), MIPS forwards to our webhook (HTTPS). This requires configuring in MIPS System Management → System Parameters or a custom forwarding rule.

### Cause 4: `mips_connections` table is empty
No branch MIPS config has been saved via the UI. The "Add Device" drawer has the MIPS connection fields but the user may not have saved them. This doesn't affect webhook receiving directly, but affects the relay forwarding path.

## Implementation Plan

### Step 1: Add webhook test button in Debug tab
Add a "Test Webhook" button that sends a simulated payload to the webhook endpoint so we can verify it's reachable and processing correctly — eliminates code bugs as a cause.

### Step 2: Fix relay forwarding path
Update `mips-webhook-receiver` to use the MIPS server's actual internal callback path from `mips_connections` (or a configurable field). Add a `callback_path` column or use the standard paths.

### Step 3: Add MIPS Connection Settings to Settings page (not just Add Device drawer)
Create a dedicated **MIPS Connection** management card accessible from the **Integrations** settings tab or the Device Command Center Dashboard. This allows changing server URL/credentials at any time, not just when adding a device.

### Step 4: Make ALL hardcoded server references dynamic
- `mips-proxy`: already reads `mips_connections` ✓
- `sync-to-mips`: already reads `mips_connections` ✓
- `mips-webhook-receiver` relay: reads `mips_connections` for relay ✓
- Debug tab: hardcoded heartbeat URL `http://212.38.94.228:9000/api/callback/heartbeat` — needs to be dynamic
- Debug tab: "Open Door (Dev 13)" hardcoded device ID — needs to use actual device

### Step 5: Fix `access_devices` record
The device `D1146D682A96B1C2` has `mips_device_id: null`. This should be `13` to enable multi-device dispatch. Add a "Link MIPS Device" action or auto-detect from MIPS device list by matching SN.

### Step 6: Update API reference documentation
Update `.lovable/mips-api-reference.md` with:
- Callback URL paths (both LAN and WAN versions)
- Webhook relay architecture
- All API endpoints with correct paths
- Photo upload constraints
- Per-branch connection model
- Restart endpoint correction (`/reboot` not `/restart`)

## Files to Modify

| File | Change |
|---|---|
| `supabase/functions/mips-webhook-receiver/index.ts` | Fix relay path, add request logging for debugging |
| `src/pages/DeviceManagement.tsx` | Add "Test Webhook" button, make heartbeat URL and device ID dynamic |
| `src/components/devices/MIPSDashboard.tsx` | Add MIPS Connection config card (view/edit server URL) |
| `src/components/devices/AddDeviceDrawer.tsx` | Auto-link `mips_device_id` from MIPS device list by SN match |
| `.lovable/mips-api-reference.md` | Full documentation update |

## Critical User Action Required

The webhook may not work because the **physical device cannot reach HTTPS endpoints**. The user needs to verify:
1. In MIPS admin, check if the callback URLs were actually saved
2. Try changing the Recognition Record Upload URL to our webhook and scan a face — check if the MIPS server shows any errors
3. If the device only supports HTTP, the architecture must change: Device → MIPS (HTTP) → MIPS forwards to our webhook (HTTPS)

We will add a "Test Webhook" button that simulates a device callback to confirm our edge function works, isolating whether the problem is device-to-webhook connectivity vs code bugs.

