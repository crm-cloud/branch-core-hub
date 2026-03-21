

# Fix Terminal Integration: Create Missing Tables & Rewrite Functions

## Root Cause Found

The 3 edge functions (`terminal-heartbeat`, `terminal-identify`, `terminal-register`) are **deployed and reachable**, but they reference two tables that **do not exist**:

- `hardware_devices` — used by all 3 functions for device tracking
- `access_logs` — used by `terminal-identify` and `terminal-register` for event logging

The actual existing tables are `access_devices` and `device_access_events`. The functions were written against a schema that was never migrated.

**Live test result**: Heartbeat returns `500` with `"Could not find the table 'public.hardware_devices' in the schema cache"`.

## The Fix (2 options — recommend Option A)

### Option A: Create the missing `hardware_devices` and `access_logs` tables

The functions are well-written and handle the device's callback protocol correctly. Rather than rewriting 3 functions to use `access_devices` (which has required `NOT NULL` constraints on `ip_address`, `branch_id`, `device_name`, `device_type` that the terminal won't send), we create the two tables the functions expect.

Also add a compatibility bridge: the heartbeat function already updates `access_devices` as a secondary write, so both tables stay in sync.

### Database Migration

**Table 1: `hardware_devices`**
- `id` uuid PK
- `device_sn` text UNIQUE NOT NULL (the device's serial number / deviceKey)
- `device_key` text
- `branch_id` uuid FK → branches (nullable, set after registration)
- `ip_address` text
- `last_online` timestamptz
- `last_payload` jsonb
- `created_at` / `updated_at` timestamptz defaults
- RLS: disabled (only accessed by service_role from edge functions)

**Table 2: `access_logs`**
- `id` uuid PK
- `device_sn` text NOT NULL
- `hardware_device_id` uuid FK → hardware_devices
- `branch_id` uuid
- `member_id` uuid
- `profile_id` uuid
- `event_type` text NOT NULL (heartbeat, identify, register)
- `result` text (member, staff, not_found, ignored, accepted)
- `message` text
- `captured_at` timestamptz
- `payload` jsonb
- `created_at` timestamptz default now()
- RLS: disabled (service_role only)

### Edge Function Fixes

The functions are mostly correct. Two small fixes needed:

1. **`terminal-identify`**: After identifying a **member**, call `member_check_in()` RPC to properly validate membership and record attendance (currently it only inserts access_logs but skips the actual check-in).

2. **`terminal-heartbeat`**: The `access_devices` bridge update uses `ip_address` as inet type but sends a string — needs a cast guard for the case where IP is null.

### UI: Update Device SN

The registered device has SN `D1146D682A96B1C2` but the terminal shows `01MA10`. The `DeviceSetupCard` already shows the SN correctly. We need to either:
- Update the DB record to match the terminal's actual `deviceKey` (which it sends in callbacks)
- OR let the heartbeat auto-create a `hardware_devices` record when `01MA10` first pings

The heartbeat function uses `upsert` on `device_sn`, so once the terminal sends its first heartbeat, a new `hardware_devices` record will be auto-created with the correct SN.

### No terminal-iclock needed

The previous plan suggested an ICLOCK protocol function. Based on the device photos, this terminal uses a **Callback-based** protocol (Heartbeat URL, Identify Callback URL, Registered Address) — NOT the ICLOCK/PUSH protocol. The 3 existing functions are the correct architecture. The `terminal-iclock` function was never created and should not be.

## Files to Modify

| File | Change |
|------|--------|
| Migration | Create `hardware_devices` and `access_logs` tables |
| `supabase/functions/terminal-identify/index.ts` | Add `member_check_in()` RPC call for member identification |
| `supabase/functions/terminal-heartbeat/index.ts` | Minor null-safety fix on IP address |

## Execution Order
1. Create DB migration for both tables
2. Fix terminal-identify to call member_check_in
3. Deploy all 3 functions
4. Test end-to-end with curl

