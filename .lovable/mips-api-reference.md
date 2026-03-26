# MIPS API Reference — RuoYi-Vue v3 (Smart Pass / Tendcent)

## Server

All API calls go through per-branch `mips_connections` table. Fallback: env vars `MIPS_SERVER_URL`, `MIPS_USERNAME`, `MIPS_PASSWORD`.

```
Default Base URL: http://212.38.94.228:9000
```

> **IMPORTANT**: Server URL is configurable per branch via Settings → Integrations or Device Command Center → Add Device drawer.

## Authentication

```
POST /login
Content-Type: application/json
TENANT-ID: 1

Request:
{
  "username": "admin",
  "password": "admin123"
}

Response:
{
  "code": 200,
  "msg": "操作成功",
  "token": "eyJhbGciOi..."
}
```

**All subsequent requests require:**
```
Authorization: Bearer <token>
TENANT-ID: 1
Content-Type: application/json
```

---

## Device Endpoints

### List All Devices
```
GET /through/device/list
```

### Remote Open Door
```
GET /through/device/openDoor/{deviceId}
```

### Reboot Device
```
GET /through/device/reboot/{deviceId}
```

### Sync Person to Device (Personnel Issue)
```
POST /through/device/syncPerson
{
  "personId": 2,
  "deviceIds": [13],
  "deviceNumType": "4"
}
```
**CRITICAL: `deviceNumType: "4"` is REQUIRED.**
**Supports multi-device: `deviceIds: [13, 14, 15]` dispatches to all devices at once.**

---

## Person Endpoints

### List Persons
```
GET /personInfo/person/list?personSn=MAIN00001&pageNum=1&pageSize=10
```

### Create Person (POST returns NO personId — must lookup after)
```
POST /personInfo/person
```

### Update Person (PUT requires FULL object for photoUri to persist)
```
PUT /personInfo/person
```
**IMPORTANT:** Partial PUT (e.g. just `{personId, photoUri}`) will NOT persist `photoUri`. You must send the complete person object from GET, with modified fields merged in.

### Delete Person
```
DELETE /personInfo/person/{personId}
```

---

## Photo Upload (Two-Step Flow)

### Rules (from manual)
- **Only JPG format** supported
- **Max 400KB** per portrait file
- Upload always uses `image/jpeg` content-type and `.jpg` extension

### Step 1: Upload file
```
POST /common/uploadHeadPhoto
Content-Type: multipart/form-data
Body: file=<jpeg, max 400KB>

Response:
{
  "code": 200,
  "fileName": "/userfiles/headPhoto/2026-03/photo_20260326150625A017.jpg",
  "url": "/userfiles/headPhoto/2026-03/photo_20260326150625A017.jpg",
  "originalFilename": "photo.jpg"
}
```

### Step 2: Assign photo to person (FULL PUT required)
```
PUT /personInfo/person
Body: { ...fullPersonObject, "photoUri": "/userfiles/headPhoto/2026-03/photo.jpg" }
```

**NOTE:** `POST /personInfo/person/importPhoto` does NOT work (returns 405).

---

## Callback / Webhook URLs

### Architecture: Primary Relay Pattern
```
Device → MIPS Middleware (HTTP) → Our Webhook (HTTPS) → Log + Attendance → Relay back to MIPS
```

The physical device only supports HTTP. It sends callbacks to the MIPS middleware server. The MIPS middleware then forwards to our Supabase Edge Function webhook (HTTPS).

### MIPS Admin Panel Configuration
Location: **Device Management → Configure Device → Server Configuration tab**

| Field | Value |
|---|---|
| **Recognition Record Upload URL** | `https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/mips-webhook-receiver` |
| **Register Person Data Upload URL** | `https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/mips-webhook-receiver` |
| **Device Heartbeat Upload URL** | Keep default (MIPS loopback) |

### Known Callback Paths (MIPS internal, version-dependent)
| Version | Attendance Callback | Heartbeat | Photo Registration |
|---|---|---|---|
| Standard v3 | `/api/callback/identify` | `/api/callback/heartbeat` | `/api/callback/imgReg` |
| TDX Admin v3 | `/tdx-admin/api/callback/identity` | `/tdx-admin/api/callback/heartbeat` | `/tdx-admin/api/callback/imgReg` |

Our relay tries `/api/callback/identify` as primary path.

### Webhook Payload (Face Scan)
```json
{
  "personNo": "MAIN00001",
  "personName": "John Doe",
  "passType": "face_0",
  "deviceKey": "D1146D682A96B1C2",
  "deviceName": "Front-Door-Device",
  "createTime": "2026-03-26 15:30:00",
  "searchScore": "0.95",
  "livenessScore": "0.98",
  "imgUri": "/path/to/capture.jpg",
  "temperature": "36.5"
}
```

### Required Response
```json
{"result": 1, "code": "000"}
```

### Pass Types
- `face_0` — Authorized face scan (check-in)
- `face_1` — Outside allowed passtime (denied)
- `face_2` — Stranger / unrecognized

---

## CRM → MIPS Field Mapping

| CRM Field | MIPS Field | Notes |
|---|---|---|
| `member_code` (hyphen-stripped) | `personSn` | `MAIN-00001` → `MAIN00001` |
| `profiles.full_name` | `name` | |
| `profiles.phone` | `mobile` | NOT `phone` |
| `profiles.email` | `email` | |
| `membership.start_date` | `validTimeBegin` | Members only |
| `membership.end_date` | `validTimeEnd` | Members only; staff/trainers = `2099-12-31 23:59:59` |
| (hardcoded) | `personType` | Always `1` |
| Members | `deptId` | `100` (Member department) |
| Staff/Trainers | `deptId` | `101` (Staff department) |
| (hardcoded) | `attendance` | Always `"1"` |
| (hardcoded) | `holiday` | Always `"1"` |

## Validity Rules

- **Members**: `validTimeBegin` = membership start, `validTimeEnd` = membership end
- **Employees/Trainers/Admins**: `validTimeEnd` = `2099-12-31 23:59:59` (permanent until deactivated)

---

## Per-Branch Connection Model

Connections stored in `mips_connections` table:

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `branch_id` | uuid | FK to branches |
| `server_url` | text | e.g. `http://212.38.94.228:9000` |
| `username` | text | MIPS admin username |
| `password` | text | MIPS admin password |
| `is_active` | boolean | Enable/disable |

All edge functions (`mips-proxy`, `sync-to-mips`, `mips-webhook-receiver`) resolve server URL from this table first, falling back to env vars.

---

## Edge Function Architecture

| Function | Purpose |
|---|---|
| `mips-proxy` | Generic proxy to RuoYi API (branch-aware) |
| `sync-to-mips` | Upsert person + photo + multi-device dispatch (member/employee/trainer) |
| `mips-webhook-receiver` | Receive device callbacks → log + attendance → relay to MIPS |

---

## Important Notes

1. **Success detection**: Always check `json.code === 200 || json.code === 0`. NEVER use `response.ok`.
2. **POST /personInfo/person returns NO personId** — must GET by personSn after create.
3. **PUT requires full object** — partial PUT drops fields like photoUri.
4. **Photo upload is two-step**: upload file → PUT photoUri on full person record.
5. **deviceNumType: "4"** is REQUIRED for syncPerson.
6. **personSn** not personNo; **mobile** not phone.
7. **Photo must be JPG and under 400KB**.
8. **Multi-device dispatch**: `deviceIds` supports arrays for simultaneous sync to multiple devices.
9. **Device is HTTP-only**: Cannot reach HTTPS endpoints directly. Use MIPS middleware as relay.
10. **Reboot endpoint**: `/through/device/reboot/{id}` (NOT `/restart`).
