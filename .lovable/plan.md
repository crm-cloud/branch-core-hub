

# Master Architecture Audit: Hardware Access Revocation, Attendance Workflow, Live Feed Upgrade

## The Core Problem (from screenshot)

The screenshot shows Yogita Lekhari scanning at the turnstile and being allowed through physically, even though the CRM correctly logs "Denied — Membership is currently frozen." The turnstile makes **local decisions** based on synced face data and `validTimeEnd`. Since the CRM never pushed a revocation to MIPS when the membership was frozen, the hardware still treats her as active.

## Postman Collection Discovery

The uploaded JSON reveals an **alternative "exterior" API** at `/interface/exterior/...`:
- `POST /interface/exterior/login` — same credentials
- `GET /interface/exterior/getPersonList` — list persons
- `POST /interface/exterior/addPerson` — add person (fields: `personSn`, `name`, `deptId`, `postId`, `hireDay`)
- `POST /interface/exterior/updatePerson` — update person
- `GET /interface/exterior/getCheckRecordList` — attendance records
- `GET /interface/exterior/listDeptNew` — departments
- `POST /interface/exterior/addDept` / `updateDept` — department CRUD
- `GET /interface/exterior/getPost` / `POST addPost` / `updatePost` — position CRUD

These are documented but we continue using the existing `/personInfo/person` and `/through/device/` APIs which are already working. The exterior API will be noted in documentation for reference.

---

## Module 1: Hardware Access Revocation (CRITICAL)

### What changes

**New edge function: `supabase/functions/revoke-mips-access/index.ts`**
- Accepts `{ member_id, action: "revoke" | "restore", reason }` 
- Looks up the member's `mips_person_id` and branch `mips_connections`
- Calls MIPS `PUT /personInfo/person` setting `validTimeEnd` to `"2000-01-01 00:00:00"` (revoke) or membership `end_date` (restore)
- Then dispatches to devices via `POST /through/device/syncPerson` to push the updated validity to hardware
- Logs the action to `access_logs`

**CRM integration points — call `revoke-mips-access` automatically when:**

| File | Trigger | Action |
|---|---|---|
| `src/services/membershipService.ts` | `approveFreeze()` sets status=frozen | Revoke |
| `src/services/membershipService.ts` | `resumeFromFreeze()` sets status=active | Restore |
| `src/components/members/CancelMembershipDrawer.tsx` | Cancel mutation succeeds | Revoke |
| `src/services/membershipService.ts` | `purchaseMembership()` succeeds | Restore (sync with new dates) |
| DB function `auto_expire_memberships()` | Cannot call edge function from DB | Add a scheduled check in the webhook or a new cron-style function |

**For auto-expiry handling**: Create a new edge function `check-expired-access` that queries memberships expired today, checks if they have `mips_person_id`, and pushes revocations. This can be triggered via Supabase cron or called manually from the dashboard.

### New DB migration
```sql
-- Track access revocation status
ALTER TABLE members ADD COLUMN IF NOT EXISTS hardware_access_status text DEFAULT 'none' 
  CHECK (hardware_access_status IN ('none', 'active', 'revoked'));
```

---

## Module 2: Member Lifecycle Access State Machine

No new pages needed — enforce the state machine in existing code:

| State | CRM Status | Hardware Action | Who Triggers |
|---|---|---|---|
| Registered, no plan | `status=active`, no membership | No sync to MIPS | Registration flow |
| Plan purchased + paid | Active membership | `sync-to-mips` with membership dates | `purchaseMembership()` |
| Frozen | `membership.status=frozen` | `revoke-mips-access` (validTimeEnd=past) | `approveFreeze()` |
| Expired | `membership.status=expired` | `revoke-mips-access` | `auto_expire_memberships` + cron |
| Unfrozen | `membership.status=active` | `sync-to-mips` (restore dates) | `resumeFromFreeze()` |
| Cancelled | `membership.status=cancelled` | `revoke-mips-access` | Cancel drawer |

**File changes:**
- `src/services/membershipService.ts` — add `revokeHardwareAccess()` and `restoreHardwareAccess()` helper functions that invoke the edge function
- `src/components/members/FreezeMembershipDrawer.tsx` — after freeze approval, call revoke
- `src/components/members/UnfreezeMembershipDrawer.tsx` — after unfreeze, call restore
- `src/components/members/CancelMembershipDrawer.tsx` — after cancel, call revoke
- `src/components/members/PurchaseMembershipDrawer.tsx` — after purchase, call sync-to-mips

---

## Module 3: Attendance In/Out Workflow

### Current state
- Check-in: automated via webhook (working) + manual rapid-entry (working)
- Check-out: manual for members (working via `member_check_out` RPC) + staff toggle (working)

### Changes needed
The check-out for members is already manual in `AttendanceDashboard.tsx`. No fundamental refactor needed. But:

**Improve `src/pages/AttendanceDashboard.tsx`:**
- Make the "Check Out" button more prominent on the Members tab — currently it exists but buried in the table
- Add a bulk check-out button for end-of-day (check out all members still checked in)
- Staff/trainer check-out: already toggle-based, but add explicit "Check Out" button alongside the toggle

---

## Module 4: Live Access Feed Upgrade (Front Desk Dashboard)

### Current `LiveAccessLog.tsx` — what's missing
- No member photo
- No billing status overlay
- No "payment due in X days" context

### Upgrade plan for `src/components/devices/LiveAccessLog.tsx`:
- Join `access_logs.member_id` → `members` → `profiles` (avatar, name) and `memberships` (end_date, status)
- For each feed entry where `member_id` is set:
  - Show member avatar image (not just icon)
  - Calculate days until membership expiry
  - Show colored badge: "Due in 3 days" (yellow), "Overdue" (red), "Frozen" (blue)
- For denied entries, show a "Manual Override" button that calls `remoteOpenDoorByBranch()`
- Add real-time Supabase subscription (already exists, just enhance the display)

**New query structure:**
```typescript
const query = supabase
  .from("access_logs")
  .select(`*, 
    members:member_id(id, member_code, biometric_photo_url, 
      profiles:user_id(full_name, avatar_url),
      memberships(status, end_date, plan_id, membership_plans(name))
    )`)
```

---

## Module 5: Device Management UI Upgrade

### Changes to `src/pages/DeviceManagement.tsx` and device components:

**Add to `access_devices` table:**
```sql
ALTER TABLE access_devices ADD COLUMN IF NOT EXISTS public_ip text;
```

**UI changes in device cards (`MIPSDevicesTab.tsx`):**
- Display `public_ip` field
- Add inline action buttons: "Force Sync", "Reboot", "Remote Open" directly on each device card
- These already exist as functions in `mipsService.ts` — just need UI buttons

---

## Module 6: API Documentation Update

**Update `.lovable/mips-api-reference.md`** with:
- The exterior API paths from the Postman collection (`/interface/exterior/...`)
- Access revocation workflow
- Member lifecycle state machine
- Hardware sync triggers

---

## Files to Create/Modify

| File | Action |
|---|---|
| `supabase/functions/revoke-mips-access/index.ts` | **Create** — revoke/restore hardware access |
| `supabase/functions/check-expired-access/index.ts` | **Create** — batch check for expired memberships |
| `src/services/membershipService.ts` | Add hardware revoke/restore calls |
| `src/services/mipsService.ts` | Add `revokeHardwareAccess()` and `restoreHardwareAccess()` |
| `src/components/members/CancelMembershipDrawer.tsx` | Call revoke after cancel |
| `src/components/members/FreezeMembershipDrawer.tsx` | Call revoke after freeze |
| `src/components/members/UnfreezeMembershipDrawer.tsx` | Call restore after unfreeze |
| `src/components/members/PurchaseMembershipDrawer.tsx` | Call sync after purchase |
| `src/components/devices/LiveAccessLog.tsx` | Add member photo, billing status, override button |
| `src/components/devices/MIPSDevicesTab.tsx` | Add public_ip display, inline action buttons |
| `src/pages/AttendanceDashboard.tsx` | Add bulk check-out, prominent check-out buttons |
| `.lovable/mips-api-reference.md` | Add exterior API docs, revocation workflow |
| **DB Migration** | Add `hardware_access_status` to members, `public_ip` to access_devices |

## Implementation Order

1. DB migration (hardware_access_status, public_ip)
2. `revoke-mips-access` edge function + deploy
3. Wire revocation into membership lifecycle (freeze/unfreeze/cancel/purchase)
4. Live Access Feed upgrade with photos + billing context + override button
5. Device Management inline actions + public IP
6. Attendance check-out improvements
7. Documentation update

