

# Architecture Refactor: MIPS-Only Integration Cleanup

## Problem
The app still has legacy direct-device artifacts: callback URLs (heartbeat/identify/register), device IP/MAC fields, and the `DeviceSetupCard` component. Since MIPS handles all device communication via TCP, these are unnecessary and confusing.

## Changes

### 1. Remove DeviceSetupCard component
Delete `src/components/devices/DeviceSetupCard.tsx` entirely. It shows heartbeat/identify/register callback URLs that are no longer relevant. Remove any imports/references to it.

### 2. Simplify AddDeviceDrawer
Strip down to only: Device Name, Serial Number, Branch, and Model. Remove:
- IP Address and MAC Address fields
- Hardware Capabilities checkboxes (facial/wiegand/relay)
- Relay Mode and Relay Delay controls
- All IP/MAC validation logic

Add a fingerprint info alert at the bottom: "Fingerprints cannot be captured via the web browser. Please register fingerprints directly on the physical gym terminal."

### 3. Simplify deviceService.ts addDevice
Remove `ip_address`, `mac_address`, `relay_mode`, `relay_delay`, `config` from the insert payload. Keep only `branch_id`, `device_name`, `serial_number`, `device_type`, `model`.

### 4. Clean up MIPSDashboard
Remove the "Local (Supabase)" vs "MIPS Server" comparison card and `getDeviceStats`/`getBiometricStats` queries. The dashboard should show MIPS-only stats since MIPS is the single source of truth for devices.

### 5. Remove legacy edge function references from Debug tab
Remove the "Test Roster Pull" button that calls `terminal-register`. Keep MIPS-specific debug tools only.

### 6. Clean up DeviceManagement.tsx
Remove import of `purgeOldAccessLogs` from deviceService (keep MIPS-focused utilities). Remove unused imports.

### 7. No secret changes needed
`MIPS_SERVER_URL`, `MIPS_USERNAME`, `MIPS_PASSWORD` are already configured as edge function secrets and accessed via `Deno.env.get()`. No hardcoded values exist in the frontend or edge functions.

## Files Modified
| File | Action |
|------|--------|
| `src/components/devices/AddDeviceDrawer.tsx` | Simplify to Name/SN/Branch/Model only + fingerprint note |
| `src/components/devices/DeviceSetupCard.tsx` | DELETE |
| `src/components/devices/MIPSDashboard.tsx` | Remove local device stats comparison |
| `src/pages/DeviceManagement.tsx` | Remove roster pull debug button, clean imports |
| `src/services/deviceService.ts` | Simplify `addDevice`, remove `DeviceAccessEvent` interface |

