

# Fix Device Command Center — Branch Selector, Per-Branch MIPS Config, Restart, Trainer Sync, Remove Capture

## Audit Findings

### Bug 1: Branch selector not working
`DeviceManagement.tsx` computes `branchFilter` but child components `MIPSDevicesTab` and `MIPSDashboard` receive `branchId` as a prop yet **never use it** — they call the MIPS API directly with no branch filtering. Only `PersonnelSyncTab` uses `branchId` in its DB queries.

### Bug 2: Restart endpoint is wrong
Code calls `GET /through/device/restart/{id}` but the user's curl shows the real endpoint is `GET /through/device/reboot/{id}`.

### Bug 3: Trainer sync fails with edge error
The edge function generates trainer code as `${branchCode}-T${id.substring(0,4)}` (e.g., `MAIN-TXXXX`), then strips hyphens → `MAINTTXXXX`. Meanwhile the UI generates `TRN-${id.substring(0,4)}` → `TRN-XXXX`. This **mismatch** means the UI code and edge function refer to different `personSn` values. Additionally, when the trainer has no `biometric_photo_url` or avatar, the sync still attempts photo upload, which may cause the edge error.

### Bug 4: Capture Photo button calls unsupported endpoint
`POST /through/device/capturePhoto` returns "Request method 'POST' is not supported". This API does not exist on this MIPS version. Remove the button entirely.

### Bug 5: MIPS server config is hardcoded in secrets
`MIPS_SERVER_URL`, `MIPS_USERNAME`, `MIPS_PASSWORD` are global secrets. User wants per-branch MIPS server configuration via the UI (Add Access Device drawer should collect server URL, port, username, password).

## Implementation Plan

### 1. Migration: Create `mips_connections` table (per-branch config)

```sql
CREATE TABLE public.mips_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  server_url text NOT NULL,        -- e.g. http://212.38.94.228:9000
  username text NOT NULL,
  password text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(branch_id)
);
ALTER TABLE public.mips_connections ENABLE ROW LEVEL SECURITY;
-- RLS: only owner/admin can manage
CREATE POLICY "Admins manage MIPS connections" ON public.mips_connections
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));
```

### 2. Fix restart endpoint in `mipsService.ts`

Change `/through/device/restart/{id}` → `/through/device/reboot/{id}` to match the real API.

### 3. Remove Capture Photo feature

- Remove `capturePhoto()` function from `mipsService.ts`
- Remove the Camera button and `capturePhotoMutation` from `PersonnelSyncTab.tsx`
- Remove ImgReg handler from `mips-webhook-receiver` (keep it but make it a no-op comment for future use)

### 4. Fix trainer code generation consistency

Standardize trainer code format across UI and edge function:
- Edge function (`sync-to-mips`): generate code as `TRN${id.substring(0,4).toUpperCase()}` (no hyphens, matching the UI's stripped format)
- UI (`PersonnelSyncTab`): keep `TRN-${id.substring(0,4)}` for display, strip hyphens when sending to MIPS

The real fix: both must produce the same `personSn` after stripping. Use `TRN${shortId}` as the canonical MIPS code. Update edge function line 442-444 to use this format instead of `${prefix}-T${...}`.

### 5. Add MIPS Connection Settings UI

Update `AddDeviceDrawer.tsx` to include a "MIPS Server Connection" section per branch:
- Server URL (with port)
- Username
- Password
- Test Connection button

This data goes into the new `mips_connections` table. The Add Device drawer gets a section for configuring the branch's MIPS connection if one doesn't exist yet.

Alternatively, add a dedicated "MIPS Connection" card in the Device Command Center Dashboard tab where admins can configure the connection per branch.

### 6. Update edge functions to use per-branch config

Update `sync-to-mips` and `mips-proxy` to:
- Accept an optional `branch_id` parameter
- Look up `mips_connections` for that branch
- Fall back to environment secrets (`MIPS_SERVER_URL`, etc.) if no per-branch config exists
- This ensures backward compatibility while enabling per-branch servers

### 7. Fix branch filtering for Devices tab

The `MIPSDevicesTab` currently shows all MIPS devices regardless of branch. Since MIPS devices are server-level (one MIPS server per branch), when a branch is selected:
- Look up the `mips_connections` for that branch
- Only show devices from that specific MIPS server
- When "All Branches" is selected, show devices from all configured servers (or the default)

For now (single server), filter by matching `access_devices.branch_id` in the DB and cross-reference with MIPS device list by `serial_number`.

## Files to Modify

| File | Change |
|---|---|
| Migration SQL | Create `mips_connections` table |
| `src/services/mipsService.ts` | Fix restart → reboot, remove capturePhoto, add per-branch proxy support |
| `src/components/devices/PersonnelSyncTab.tsx` | Remove Capture Photo button and mutation |
| `supabase/functions/sync-to-mips/index.ts` | Fix trainer code format, use per-branch MIPS config |
| `supabase/functions/mips-proxy/index.ts` | Accept branch_id, look up mips_connections |
| `src/components/devices/AddDeviceDrawer.tsx` | Add MIPS connection config fields |
| `src/components/devices/MIPSDevicesTab.tsx` | Use branch filtering |
| `src/pages/DeviceManagement.tsx` | Pass branch context properly |

## Testing Strategy

Before code changes, curl-verify:
1. `GET /through/device/reboot/13` — confirm this is the correct restart endpoint
2. Confirm `mips_connections` table is created and accessible
3. Test sync with corrected trainer code format

