

# Complete MIPS Integration Rewrite — Cloud-Only Architecture

## Problem Summary

The entire MIPS integration is broken. The edge functions use endpoints from a different API (`/apiExternal/generateToken`, `Owl-Auth-Token`, `/admin/devices/page`, etc.) but the actual server at `http://212.38.94.228:9000` runs **RuoYi-Vue v3** with completely different endpoints. Every call fails with `"No endpoint"`.

Additionally, three edge functions (`terminal-heartbeat`, `terminal-register`, `terminal-identify`) were built for direct LAN device communication, which is impossible because the device is behind CGNAT.

## Verified API Reference (from previous curl testing)

```text
Server: http://212.38.94.228:9000
Auth:   POST /login  →  {"username":"admin","password":"admin123"}
Header: Authorization: Bearer <token>, TENANT-ID: 1

DEVICES
  GET  /through/device/list              → list all devices
  GET  /through/device/openDoor/{id}     → remote open door
  POST /through/device/syncPerson        → dispatch person to device

PERSONS
  GET  /personInfo/person/list           → list persons
  POST /personInfo/person                → create/update person
  DEL  /personInfo/person/{id}           → delete person

Device D1146D682A96B1C2 = MIPS deviceId 13
```

## What Gets Removed

| Edge Function | Reason |
|---|---|
| `terminal-heartbeat` | LAN-only architecture, device behind CGNAT, never receives calls |
| `terminal-register` | Same — built for direct device-to-server communication that can't work |
| `terminal-identify` | Same — duplicate of webhook receiver but for LAN mode |

These three functions total ~1,600 lines of dead code. They reference `hardware_devices` table (which is separate from `access_devices`) and are never called by the MIPS middleware.

## What Gets Rewritten

### 1. `mips-proxy/index.ts` — Complete rewrite
- **Auth**: `POST /login` with JSON body → `Authorization: Bearer <token>` + `TENANT-ID: 1`
- **Proxy**: Pass `endpoint`, `method`, `data` through with correct headers
- Remove `Owl-Auth-Token`, `siteId`, form-urlencoded auth

### 2. `sync-to-mips/index.ts` — Complete rewrite
- **Create person**: `POST /personInfo/person` with correct field mapping
- **Photo**: Fetch from storage, base64 encode, include in person payload
- **Dispatch**: After person creation, call `POST /through/device/syncPerson` targeting device ID 13
- Remove all old MIPS endpoint references

### 3. `mips-webhook-receiver/index.ts` — Keep & fix
- Already correctly returns `{"result":1,"code":"000"}`
- Already handles member/staff lookup and attendance logging
- Only change: ensure it handles RuoYi callback field names if they differ

### 4. `src/services/mipsService.ts` — Update endpoints
- Change all `callMIPSProxy` endpoint paths to match RuoYi API
- `/admin/devices/page` → `/through/device/list`
- `/admin/devices/remote/opendoor` → `/through/device/openDoor/{id}`
- `/admin/person/employees/page` → `/personInfo/person/list`
- `/admin/person/employees/permission` → `/through/device/syncPerson`

### 5. `src/components/devices/MIPSDevicesTab.tsx` — Minor update
- Adapt to new response shape from `/through/device/list`

## API Documentation (generated output)

A markdown document will be created at `.lovable/mips-api-reference.md` documenting every endpoint, auth flow, request/response shapes, and the CRM-to-MIPS field mapping.

## Implementation Steps

1. **Rewrite `mips-proxy`** with RuoYi auth + correct header/endpoint passthrough
2. **Rewrite `sync-to-mips`** with person creation + photo + dispatch flow
3. **Update `mipsService.ts`** endpoint paths and response parsing
4. **Update `MIPSDevicesTab.tsx`** for new device list response shape
5. **Delete `terminal-heartbeat`, `terminal-register`, `terminal-identify`** edge functions
6. **Remove config.toml entries** for deleted functions
7. **Create API reference document**
8. **End-to-end curl testing** against live server before and after each change

## Verification Plan

After each edge function rewrite, curl test it:
1. `mips-proxy` → test `/through/device/list` returns device list
2. `sync-to-mips` → test person creation with a test member
3. Dashboard → verify "Connected" status and device list renders
4. Personnel Sync → verify sync + dispatch flow works end-to-end

