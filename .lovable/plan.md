

# Robust MIPS Verification & Re-sync Workflow

## Problem

The CRM marks members as "synced" after getting a success response from `POST /personInfo/person`, but there's no verification that the person actually exists on the MIPS server or was dispatched to the device. Members can show "Synced" in the UI while being absent from the device roster.

Additionally, the Personnel Sync tab has UX issues:
- Bulk sync requires `hasPhoto` (causes 0/0 results)
- Individual sync disabled without photo (but data-only sync should work)
- No way to verify device-side presence
- No way to upload a photo from the app for sync

## Solution

### 1. Add `verifyPersonOnMIPS()` to `mipsService.ts`

New function that calls `GET /personInfo/person/list` and searches by `personNo` (hyphen-stripped). Returns `{ exists: boolean, hasPhoto: boolean, mipsId: number | null, personData: object }`.

### 2. Add "Verify & Re-sync" workflow to `sync-to-mips` edge function

Add an optional `verify_only` mode to the edge function request body. When `verify_only: true`, it:
- Fetches the MIPS person list
- Searches for the member by stripped `personNo`
- Returns `{ verified: boolean, mips_person: {...} }` without creating/updating
- If not found, returns `{ verified: false }` so the UI can offer re-sync

### 3. Rewrite `PersonnelSyncTab.tsx`

**Data layer changes:**
- Remove `hasPhoto` from bulk sync filter — allow data-only sync
- Add a `verifiedOnDevice` field to `SyncPerson` (populated on-demand, not on load)

**New per-person actions (3 buttons):**
- **Verify** — calls `verifyPersonOnMIPS(code)`, shows green check or red X with toast
- **Sync** — enabled always (not gated on `hasPhoto`), syncs person data + photo if available  
- **Capture** — triggers device camera capture (existing, only for synced persons)

**New bulk actions:**
- "Verify All Synced" — checks every "synced" member against MIPS roster, marks mismatches
- "Sync All Pending" — syncs all pending/failed (remove `hasPhoto` gate)
- "Re-sync Stale" — re-syncs members marked synced but not verified on device

**Display improvements:**
- Show both codes: `MAIN-00005` → `MAIN00005` (CRM → MIPS)
- Show verification status: verified/unverified/mismatch badge
- Show photo status separately from sync status

### 4. Improve Debug tab in `DeviceManagement.tsx`

Add these debug tools:
- **Verify Single Member** — pick a member, check if present in MIPS person list
- **Test Open Door** — one-click for device 13
- **Compare CRM vs MIPS** — shows side-by-side count (CRM synced count vs MIPS person count)
- **Test Single Sync** — syncs a specific member and verifies afterward

### 5. Photo upload from app in Personnel Sync

Add an inline photo upload button per person:
- Uses existing `compressImageForDevice` utility
- Uploads to Supabase Storage `member-photos` bucket
- Updates `biometric_photo_url` on the member record
- Auto-triggers sync after upload

## Files to Modify

| File | Change |
|---|---|
| `src/services/mipsService.ts` | Add `verifyPersonOnMIPS()`, `verifyAllSynced()`, `compareCRMvsMIPS()` |
| `supabase/functions/sync-to-mips/index.ts` | Add `verify_only` mode |
| `src/components/devices/PersonnelSyncTab.tsx` | Full rewrite with verify/re-sync/upload workflow |
| `src/pages/DeviceManagement.tsx` | Enhanced debug tools |

## Technical Details

- `verifyPersonOnMIPS(personNo)` calls `callMIPSProxy("/personInfo/person/list", "GET", { personNo: strippedCode })` — RuoYi supports filtering by `personNo` query param
- Verification is on-demand (button click), not on page load, to avoid hammering the MIPS server
- The bulk verify fetches the full person list once (`pageSize=200`) and cross-references locally
- Photo upload uses existing `compressImageFile()` → upload to `member-photos/{memberId}.jpg` → update DB → trigger sync

