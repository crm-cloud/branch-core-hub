# MIPS API Reference — RuoYi-Vue v3 (Smart Pass / Tendcent)

## Server

```
Base URL: http://212.38.94.228:9000
```

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

### Restart Device
```
GET /through/device/restart/{deviceId}
```

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

### Step 1: Upload file
```
POST /common/uploadHeadPhoto
Content-Type: multipart/form-data
Body: file=<jpeg>

Response:
{
  "code": 200,
  "fileName": "/userfiles/headPhoto/2026-03/photo_20260326150625A017.jpg",
  "url": "/userfiles/headPhoto/2026-03/photo_20260326150625A017.jpg",
  "originalFilename": "photo.jpg"
}
```

### Step 2: Assign photo to person
```
PUT /personInfo/person
Body: { ...fullPersonObject, "photoUri": "/userfiles/headPhoto/2026-03/photo.jpg" }
```

**NOTE:** `POST /personInfo/person/importPhoto` does NOT work (returns 405).

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

## Device Reference

| SN | MIPS ID | Role |
|---|---|---|
| `D1146D682A96B1C2` | `13` | Primary turnstile |

## Edge Function Architecture

| Function | Purpose |
|---|---|
| `mips-proxy` | Generic proxy to RuoYi API |
| `sync-to-mips` | Upsert person + photo + dispatch (supports member/employee/trainer) |
| `mips-webhook-receiver` | Receive device callbacks for attendance |

## Webhook Receiver

Endpoint: `https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/mips-webhook-receiver`

Must return: `{"result": 1, "code": "000"}`

## Important Notes

1. **Success detection**: Always check `json.code === 200 || json.code === 0`. NEVER use `response.ok`.
2. **POST /personInfo/person returns NO personId** — must GET by personSn after create.
3. **PUT requires full object** — partial PUT drops fields like photoUri.
4. **Photo upload is two-step**: upload file → PUT photoUri on full person record.
5. **deviceNumType: "4"** is REQUIRED for syncPerson.
6. **personSn** not personNo; **mobile** not phone.
