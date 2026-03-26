

# Fix MIPS Connection: Path Stripping Bug

## Root Cause

The `getHostUrl()` function in both `mips-proxy/index.ts` and `sync-to-mips/index.ts` does this:

```typescript
function getHostUrl(): string {
  const MIPS_URL = Deno.env.get("MIPS_SERVER_URL")!.replace(/\/+$/, "");
  const urlObj = new URL(MIPS_URL);
  return `${urlObj.protocol}//${urlObj.host}`;  // ← STRIPS /MIPS path!
}
```

If `MIPS_SERVER_URL` is `http://212.38.94.228:9000/MIPS`, this returns `http://212.38.94.228:9000` -- losing the `/MIPS` prefix. Every API call then hits the wrong path (e.g., `/apiExternal/generateToken` instead of `/MIPS/apiExternal/generateToken`), returning `"No endpoint"`.

The edge function logs show this error repeating every 15 seconds due to the dashboard's auto-refresh polling.

## Fix

Change `getHostUrl()` in both edge functions to preserve the full URL path:

```typescript
function getBaseUrl(): string {
  return Deno.env.get("MIPS_SERVER_URL")!.replace(/\/+$/, "");
}
```

Then replace all `hostUrl` references. The auth endpoint becomes `${baseUrl}/apiExternal/generateToken` and API endpoints become `${baseUrl}/admin/devices/page`, etc.

## Files to Modify

| File | Change |
|---|---|
| `supabase/functions/mips-proxy/index.ts` | Replace `getHostUrl()` with `getBaseUrl()` that preserves full path |
| `supabase/functions/sync-to-mips/index.ts` | Same fix to `getHostUrl()` |

## Verification Plan

After deploying the fix, I will:
1. Call `mips-proxy` with `/admin/devices/page` to verify the device list returns
2. Verify the dashboard shows "Connected" with device D1146D682A96B1C2 online
3. Check device stats (persons, faces) match what the MIPS panel shows (1 person, 1 photo)

This is a 2-line fix in each file -- no other logic changes needed.

