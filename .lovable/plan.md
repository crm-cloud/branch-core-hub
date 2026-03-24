

# Fix Live Access Feed + Audit Webhook & Photo Capture

## Root Causes Found

### 1. RLS blocks all reads on `access_logs` (PRIMARY ISSUE)
RLS is **enabled** on `access_logs` but there are **zero policies**. The webhook receiver writes using `service_role` key (bypasses RLS), so inserts work. But the frontend uses the `anon` key, so `SELECT` returns nothing -- the Live Feed will always show "No access events yet" regardless of data.

### 2. No webhook traffic has reached the endpoint
Edge function logs show zero invocations of `mips-webhook-receiver`. This means either:
- MIPS Smart Pass hasn't been configured to push events to the webhook URL yet, OR
- The configuration exists but MIPS hasn't triggered any face scans since setup

### 3. Photo capture endpoint looks correct
The `capturePhoto` function already uses the verified `POST /admin/person/employees/take_photo` with `{"ids":[N],"deviceIds":[N]}` and `contentType: "json"`. This matches the user's curl exactly. No fix needed here.

## Plan

### Step 1: Add RLS policies for `access_logs`
Create a migration adding:
- **SELECT** policy for authenticated users with `owner`, `admin`, `manager`, or `staff` roles (using `has_any_role`)
- **INSERT** policy is not needed (webhook uses service_role)

```sql
CREATE POLICY "Staff can view access logs"
ON public.access_logs FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));
```

### Step 2: Verify realtime is enabled
Already confirmed: `ALTER PUBLICATION supabase_realtime ADD TABLE public.access_logs` exists in migrations. Good.

### Step 3: Test the webhook receiver
After adding RLS, invoke the webhook receiver with a simulated MIPS payload to confirm it writes to `access_logs` and appears in the Live Feed. Use a test curl against the edge function.

### Step 4: Guide on MIPS webhook configuration
The user says they've configured the webhook URL in Smart Pass. After fixing RLS + testing, real face scan events should flow through. If they still don't, we need to verify the MIPS "Webhook" or "Callback URL" configuration in the Smart Pass admin panel.

## Files to Modify
| File | Change |
|------|--------|
| New migration | Add SELECT RLS policy on `access_logs` |

No code changes needed -- the `LiveAccessLog` component and `mips-webhook-receiver` function are already correctly implemented. The only blocker is the missing RLS policy.

