# MIPS API Reference — RuoYi-Vue v3 (Smart Pass)

## Server

```
Base URL: http://212.38.94.228:9000
```

## Authentication

```
POST /login
Content-Type: application/json

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
      "deviceName": "Incline Entry",
      "ip": "10.0.1.211",
      "personCount": 1,
      "faceCount": 1,
      "onlineFlag": 1,
      "lastActiveTime": "2025-01-15 10:30:00"
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

### Sync Person to Device (Dispatch)
```
POST /through/device/syncPerson
Content-Type: application/json

Request:
{
  "personId": "42",
  "deviceIds": [13]
}
```

### Restart Device
```
GET /through/device/restart/{deviceId}
```

---

## Person Endpoints

### List Persons
```
GET /personInfo/person/list?pageNum=1&pageSize=50

Response:
{
  "code": 200,
  "rows": [
    {
      "id": 42,
      "personNo": "MAIN00001",
      "name": "John Doe",
      "phone": "9876543210",
      "photoUrl": "...",
      "departmentName": "Default"
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
  "personNo": "MAIN00001",
  "name": "John Doe",
  "phone": "9876543210",
  "remark": "Gym Member",
  "personPhotoUrl": "data:image/jpeg;base64,..."
}
```

### Delete Person
```
DELETE /personInfo/person/{id}
```

---

## CRM → MIPS Field Mapping

| CRM Field | MIPS Field | Notes |
|---|---|---|
| `member_code` (hyphen-stripped) | `personNo` | `MAIN-00001` → `MAIN00001` |
| `profiles.full_name` | `name` | |
| `profiles.phone` | `phone` | |
| `biometric_photo_url` or `avatar_url` | `personPhotoUrl` | Base64 data URI, max 400KB |
| `membership.end_date` | (used for expiry logic) | |

## Device Reference

| SN | MIPS ID | Role |
|---|---|---|
| `D1146D682A96B1C2` | `13` | Primary turnstile |

## Edge Function Architecture

| Function | Purpose | Auth |
|---|---|---|
| `mips-proxy` | Generic proxy to RuoYi API | `verify_jwt = false` |
| `sync-to-mips` | Create person + photo + dispatch | `verify_jwt = true` |
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
