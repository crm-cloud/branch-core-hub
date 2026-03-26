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

Response:
{
  "code": 200,
  "rows": [
    {
      "id": 13,
      "deviceKey": "D1146D682A96B1C2",
      "deviceName": "INC",
      "ip": "10.0.1.211",
      "personCount": 1,
      "photoCount": 1,
      "onlineFlag": 1,
      "lastActiveTime": "2026-03-26 14:18:56"
    }
  ],
  "total": 1
}
```

### Remote Open Door
```
GET /through/device/openDoor/{deviceId}

Example: GET /through/device/openDoor/13
```

### Sync Person to Device (Dispatch / Personnel Issue)
```
POST /through/device/syncPerson
Content-Type: application/json

Request:
{
  "personId": 2,
  "deviceIds": [13],
  "deviceNumType": "4"
}

Response (success):
{
  "code": 200,
  "msg": "Downloading personnel information!"
}
```

**CRITICAL: `deviceNumType` is REQUIRED.** Value `"4"` = by device ID. Without it → NPE error.

### Restart Device
```
GET /through/device/restart/{deviceId}
```

---

## Person Endpoints

### List Persons
```
GET /personInfo/person/list?pageNum=1&pageSize=50

Filter by personSn:
GET /personInfo/person/list?personSn=MAIN00001&pageNum=1&pageSize=10

Response:
{
  "code": 200,
  "rows": [
    {
      "personId": 2,
      "personSn": "MAIN00001",
      "personType": 1,
      "deptId": 100,
      "deptName": "Member",
      "name": "John Doe",
      "mobile": "9876543210",
      "email": "john@example.com",
      "gender": "M",
      "attendance": "1",
      "holiday": "1",
      "photoUri": null,
      "status": "0",
      "tenantId": 1
    }
  ],
  "total": 1
}
```

### Create/Update Person
```
POST /personInfo/person
Content-Type: application/json

Request:
{
  "personSn": "MAIN00001",
  "personType": 1,
  "deptId": 100,
  "name": "John Doe",
  "mobile": "9876543210",
  "email": "john@example.com",
  "gender": "M",
  "attendance": "1",
  "holiday": "1",
  "remark": "Gym Member",
  "personPhotoUrl": "data:image/jpeg;base64,..."
}

Response (success):
{
  "code": 200,
  "msg": "操作成功"
}
```

**REQUIRED fields:** `personSn`, `personType` (integer, use `1`), `deptId` (integer, use `100`), `name`

### Delete Person
```
DELETE /personInfo/person/{personId}
```

---

## CRM → MIPS Field Mapping

| CRM Field | MIPS Field | Notes |
|---|---|---|
| `member_code` (hyphen-stripped) | `personSn` | `MAIN-00001` → `MAIN00001` |
| `profiles.full_name` | `name` | |
| `profiles.phone` | `mobile` | NOT `phone` |
| `profiles.email` | `email` | |
| `biometric_photo_url` or `avatar_url` | `personPhotoUrl` | Base64 data URI, max 400KB |
| (hardcoded) | `personType` | Always `1` |
| (hardcoded) | `deptId` | Always `100` (Member department) |
| (hardcoded) | `gender` | Default `"M"` |
| (hardcoded) | `attendance` | Always `"1"` |
| (hardcoded) | `holiday` | Always `"1"` |

## MIPS Response → CRM Mapping

| MIPS Response Field | CRM Usage |
|---|---|
| `data.personId` | Stored as `mips_person_id` |
| `code` | `200` or `0` = success. Do NOT trust HTTP status (errors wrapped in 200) |

## Device Reference

| SN | MIPS ID | Role |
|---|---|---|
| `D1146D682A96B1C2` | `13` | Primary turnstile |

## Edge Function Architecture

| Function | Purpose | Auth |
|---|---|---|
| `mips-proxy` | Generic proxy to RuoYi API | `verify_jwt = false` |
| `sync-to-mips` | Create person + photo + dispatch | `verify_jwt = false` |
| `mips-webhook-receiver` | Receive device callbacks for attendance | `verify_jwt = false` |

## Webhook Receiver

The MIPS middleware sends callbacks to:
```
https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/mips-webhook-receiver
```

Must return exactly:
```json
{"result": 1, "code": "000"}
```

## Important Notes

1. **Success detection**: MIPS wraps errors in HTTP 200. Always check `json.code === 200 || json.code === 0`. NEVER use `response.ok`.
2. **deviceNumType**: Required for `syncPerson`. Use `"4"` for device ID-based dispatch.
3. **personSn vs personNo**: The actual field is `personSn`, not `personNo`.
4. **mobile vs phone**: The actual field is `mobile`, not `phone`.
5. **personType & deptId**: Both are REQUIRED integers. Without them → NullPointerException.
