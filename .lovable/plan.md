

# Audit: MIPS Webhook Callback URLs & Attendance Flow

## Current State — It IS Working

The webhook receiver is functioning correctly. Evidence from the database:

- **access_logs**: Entry at `2026-03-24 15:49:04` — `result: member`, `message: "Member TEST MEMBER 1 checked in via face"`, `device_sn: Front-Door-Device`
- **member_attendance**: Matching biometric check-in at `2026-03-24 15:49:04`, `check_in_method: biometric`

The attendance WAS marked in the system. The webhook received the face scan, looked up the member, called `member_check_in` RPC, and logged everything correctly.

## Where to Enter the Callback URL

From the uploaded MIPS admin screenshot (`Device Configuration → Server Configuration`), there are 3 callback URLs currently pointing to the MIPS server itself (loopback):

| Field | Current Value | Should Be |
|---|---|---|
| **Recognition Record Upload URL** | `http://212.38.94.228:9000/api/callback/identify` | `https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/mips-webhook-receiver` |
| **Device Heartbeat Upload URL** | `http://212.38.94.228:9000/api/callback/heartbeat` | Keep as-is (or point to webhook for heartbeat monitoring) |
| **Register Person Data Upload URL** | `http://212.38.94.228:9000/api/callback/imgReg` | `https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/mips-webhook-receiver` |

**The "Recognition Record Upload URL" is the critical one** — this is where the device sends face-scan events. Change it to our webhook URL.

**Important**: The MIPS middleware may still need its own internal callback for internal processing. If changing the URL breaks MIPS's own attendance records, the solution is a "relay" approach (described below).

## The Relay Approach (User's Suggestion)

The user suggested: "fetch data into our webhook first, then push to MIPS server so both get data from a single URL." This is a smart proxy/relay pattern:

```text
Device → Our Webhook (primary) → Log + Mark Attendance → Forward to MIPS internal callback
```

### Implementation

Modify `mips-webhook-receiver` to:
1. Receive the device callback (as it does now)
2. Process it (lookup person, mark attendance, log to access_logs)
3. **Forward the original payload** to the MIPS internal callback URL (`http://212.38.94.228:9000/api/callback/identify`) so MIPS middleware also gets the data

This way:
- Our system gets real-time attendance
- MIPS middleware still gets its records for device management
- Only one URL needs to be configured on the device

### Changes Required

**File: `supabase/functions/mips-webhook-receiver/index.ts`**
- After processing the webhook and before returning `DEVICE_ACK`, forward the original payload to the MIPS server's internal callback URL
- Look up the branch's `mips_connections` to get the server URL, then POST to `{server_url}/api/callback/identify`
- This forwarding is fire-and-forget (don't block the response)

**File: `src/pages/DeviceManagement.tsx` (Debug tab)**
- Update the webhook guidance to explain the relay approach
- Add clear instructions with the 3 MIPS fields and what each should contain
- Add a visual diagram showing the data flow

### Webhook Guidance Update (Debug tab)

Show a clear card with:
1. **Recognition Record Upload URL** → Our webhook URL (copy button)
2. **Register Person Data Upload URL** → Our webhook URL (copy button)  
3. **Device Heartbeat Upload URL** → Keep default or point to webhook for monitoring
4. Step-by-step: "Go to MIPS Admin → Device Management → Click 'Configure' on your device → Server Configuration tab → Paste URLs → OK"
5. Explain relay: "Our system receives the scan first, marks attendance, then automatically forwards the data to your MIPS server"

## Files to Modify

| File | Change |
|---|---|
| `supabase/functions/mips-webhook-receiver/index.ts` | Add relay/forwarding to MIPS internal callback after processing |
| `src/pages/DeviceManagement.tsx` | Improve Debug tab webhook guidance with field-by-field instructions matching the MIPS admin screenshot |

## No Other Fixes Needed

The Live Access Feed and attendance marking are already working correctly — the test record proves it. The issue is simply that the MIPS callback URLs haven't been changed to point to our webhook yet. Once the "Recognition Record Upload URL" in the MIPS admin panel points to our webhook, every face scan will:
1. Appear in Live Access Feed (real-time via Supabase Realtime)
2. Auto-mark member attendance (via `member_check_in` RPC)
3. Auto-mark staff/trainer attendance (via `staff_attendance` insert/toggle)

