

# Fix Device Command Center — Branch Filtering, Trainer/Admin Sync, Photo Upload, UI Redesign

## Audit Findings

### Bug 1: Branch selector not filtering Dashboard or Devices tabs
`MIPSDashboard` receives `branchId` prop but never uses it — it calls `testMIPSConnection()` and `fetchMIPSDevices()` globally. Same for `MIPSDevicesTab`: it fetches ALL MIPS devices globally, then tries to filter by matching `access_devices.serial_number`, but if no `access_devices` records exist for a branch or the branch has no devices registered locally, filtering fails. The Dashboard KPI cards always show global counts.

**Root cause**: The proxy calls don't pass `branch_id`, so they always use the global MIPS server. When "Branch 2" is selected but has no `mips_connections` entry and no `access_devices` records, the system still shows all devices from the default server.

### Bug 2: Trainer sync fails — "Employee not found"
Edge function log: `sync-to-mips error: Employee not found: Cannot coerce the result to a single JSON object`.
This means the `person_type` reaching the edge function is `"employee"` instead of `"trainer"`. Looking at the client code in `PersonnelSyncTab.tsx` line 137: `syncPersonToMIPS(person.type, person.id, branchId)` — this correctly sends `"trainer"`. But the edge function's employee query at line 419 uses `.single()` which throws when the employee_code lookup returns no results or multiple results. The error suggests the trainer sync invocation is somehow hitting the employee branch.

**Likely cause**: The `trainers` table `.select()` query at line 437-441 includes `profiles:user_id(...)`. If a trainer has no `user_id` set (null), the join fails with a coercion error on `.single()`. Need to use `.maybeSingle()` or handle gracefully.

### Bug 3: Photo upload fails — "Edge Function returned a non-2xx status code"  
The edge function `sync-to-mips` itself returns proper JSON, but `supabase.functions.invoke()` sees a non-2xx HTTP status if the function throws an unhandled error. The photo fetch from Supabase Storage public URLs may fail if the URL is malformed or the file doesn't exist. Also, PNG/WebP images are sent as-is with a `.jpg` extension — MIPS only accepts actual JPEG data, not renamed PNGs.

### Bug 4: Branch name not shown on device cards
`MIPSDeviceCard` only shows device name and SN but not which branch it belongs to.

### Bug 5: Webhook URL explanation needed
The webhook URL must be configured in the MIPS middleware admin panel under the "Register Person Data Upload URL" or callback/webhook settings. It's not entered anywhere in our app — it's entered in the MIPS server's device configuration.

### Bug 6: Personnel Sync UI needs redesign
Current UI is a flat list mixing all types. User wants separate tabs for Members vs Employees/Trainers, and registered vs unregistered views.

## Implementation Plan

### Step 1: Fix trainer/admin sync in edge function
In `supabase/functions/sync-to-mips/index.ts`:
- Change all `.single()` calls to `.maybeSingle()` for member, employee, and trainer queries to prevent coercion errors
- Add null checks after each query with proper error messages
- Ensure the `person_type === "trainer"` branch is reached correctly

### Step 2: Fix branch-aware proxy calls
In `src/services/mipsService.ts`:
- Update `testMIPSConnection()`, `fetchMIPSDevices()`, `fetchMIPSPassRecords()`, `fetchMIPSEmployees()` to accept optional `branchId` parameter and pass it through to `callMIPSProxy()`
- Update `remoteOpenDoor()` and `restartDevice()` to accept optional `branchId`

In `src/components/devices/MIPSDashboard.tsx`:
- Pass `branchId` to `testMIPSConnection(branchId)` and `fetchMIPSDevices(branchId)` 
- Include `branchId` in query keys so cache is per-branch
- When branch changes, KPI cards update to show only that branch's data

In `src/components/devices/MIPSDevicesTab.tsx`:
- Pass `branchId` through to `fetchMIPSDevices(branchId)` 
- Include `branchId` in query key for MIPS devices
- Add branch name badge to each device card

### Step 3: Fix photo upload
In `supabase/functions/sync-to-mips/index.ts` `uploadPhoto()`:
- Skip photo upload if `photoUrl` is empty/null (don't attempt fetch)
- Add try/catch around photo fetch with graceful degradation — sync should succeed even if photo fails
- Validate that the image bytes start with JPEG magic bytes (FF D8 FF); if not, log warning and skip photo

### Step 4: Redesign Personnel Sync UI
Replace the flat list with a tabbed layout:
- **Members** tab and **Staff & Trainers** tab
- Within each tab, show two sections: "Registered on MIPS" (synced) and "Not Registered" (pending/failed)
- Card-based layout instead of flat list items
- Each card shows: avatar, name, code, type badge, sync status, photo status, MIPS ID
- Action buttons: Sync, Verify, Upload Photo
- Summary stats bar at the top with counts per category
- Better visual distinction: green border for synced, orange for pending, red for failed

### Step 5: Add branch name to device cards
In `MIPSDevicesTab`:
- Cross-reference MIPS devices with `access_devices` table to get `branch_id`
- Look up branch name from branches list
- Show branch name badge on each device card

### Step 6: Add webhook URL guidance to Debug tab
In `DeviceManagement.tsx` Debug section:
- Add an info card explaining where to enter the webhook URL
- Text: "Enter this URL in your MIPS middleware admin panel → Device Configuration → Register Person Data Upload URL (callback URL)"
- Include a copy button for the URL

### Step 7: Audit edge functions (no deletions needed)
All 21 edge functions serve active features:
- `admin-create-user`, `create-member-user`, `create-owner`, `create-staff-user` — auth flows
- `check-setup` — initial setup wizard
- `mips-proxy`, `sync-to-mips`, `mips-webhook-receiver` — MIPS integration
- `ai-auto-reply`, `ai-dashboard-insights`, `generate-fitness-plan` — AI features
- `capture-lead`, `webhook-lead-capture` — lead capture
- `create-payment-order`, `payment-webhook` — payment processing
- `export-data` — data export
- `manage-whatsapp-templates`, `send-broadcast`, `send-reminders`, `send-whatsapp` — communication
- `run-retention-nudges` — retention automation

No functions need deletion. All are actively used by the app.

## Files to Modify

| File | Change |
|---|---|
| `supabase/functions/sync-to-mips/index.ts` | Fix `.single()` → `.maybeSingle()`, add null checks, fix photo skip logic |
| `src/services/mipsService.ts` | Add `branchId` param to all MIPS API functions |
| `src/components/devices/MIPSDashboard.tsx` | Pass `branchId` to proxy calls, per-branch query keys |
| `src/components/devices/MIPSDevicesTab.tsx` | Branch-aware fetching, branch name on cards |
| `src/components/devices/PersonnelSyncTab.tsx` | Redesign with Members/Staff tabs, registered/unregistered sections, card layout |
| `src/pages/DeviceManagement.tsx` | Add webhook URL guidance in Debug tab |

## Webhook URL Explanation (for user)
The webhook URL `https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/mips-webhook-receiver` is entered in the **MIPS middleware admin panel** (http://212.38.94.228:9000/MIPS/), not in the gym app. In the MIPS dashboard, go to **System Configuration → Device Settings** and set the "Register Person Data Upload URL" or "Webhook Callback URL" to this value. The MIPS hardware will then POST face-scan events to this endpoint automatically.

