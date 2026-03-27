# Branch Core Hub

Central operations platform for gym and fitness branch management.

## Local development

Prerequisites:

- Node.js 18+
- npm

Run locally:

```sh
npm install
npm run dev
```

Build for production:

```sh
npm run build
npm run preview
```

## Stack

- Vite
- React + TypeScript
- Tailwind CSS
- Radix UI / shadcn-ui
- Supabase (via Lovable Cloud)

---

## MIPS Hardware Integration

### Overview

The system integrates with MIPS (RuoYi-Vue v3) middleware for biometric face-recognition terminals. This enables automated attendance marking for members, employees, and trainers via face scan.

### Edge Functions

| Function | Endpoint | Purpose |
|---|---|---|
| `mips-proxy` | `/functions/v1/mips-proxy` | Generic proxy to MIPS RuoYi API (branch-aware) |
| `sync-to-mips` | `/functions/v1/sync-to-mips` | Sync person (member/employee/trainer) to MIPS: create/update person, upload photo, dispatch to devices |
| `mips-webhook-receiver` | `/functions/v1/mips-webhook-receiver` | Receive face-scan callbacks from MIPS → lookup person → mark attendance → log → relay |

### Webhook URL (for MIPS Admin Panel)

```
https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/mips-webhook-receiver
```

Set this in MIPS Admin → Device Management → Configure Device → Server Configuration:
- **Recognition Record Upload URL**: (above URL)
- **Register Person Data Upload URL**: (above URL)
- **Device Heartbeat Upload URL**: Keep default

### Attendance Flow

```
Face Terminal → MIPS Middleware (HTTP) → mips-webhook-receiver (HTTPS)
  → 3-tier person lookup (mips_person_sn → mips_person_id → code normalization)
  → Member: member_check_in RPC → member_attendance
  → Staff/Trainer: check-in/out toggle → staff_attendance
  → access_logs (all events)
  → Relay original payload back to MIPS
```

### Person Sync Flow

```
CRM (Add/Edit Member/Employee/Trainer) → sync-to-mips Edge Function
  → Login to MIPS RuoYi API
  → Create/Update person (personSn = hyphen-stripped code)
  → Upload photo (JPG, max 400KB, two-step: upload file → PUT photoUri)
  → Dispatch to all active devices (POST /through/device/syncPerson)
  → Write mips_person_id + mips_person_sn back to CRM
```

### Key Database Columns

| Table | Column | Description |
|---|---|---|
| members/employees/trainers | `mips_person_id` | Numeric MIPS personId (e.g. "21") |
| members/employees/trainers | `mips_person_sn` | PersonSn sent to MIPS (e.g. "EMPMM3FYN8U") — used for webhook lookup |
| members/employees/trainers | `mips_sync_status` | `synced`, `failed`, or `pending` |

### Per-Branch Configuration

MIPS server connections are stored in `mips_connections` table (per branch). Managed via Device Command Center → MIPS Server Connection card.

### Full API Reference

See `.lovable/mips-api-reference.md` for complete MIPS API documentation including endpoints, payload formats, field mappings, and troubleshooting.
