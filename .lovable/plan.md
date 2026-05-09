## Goal
Move the "Disaster Recovery — Sync to fallback now" widget out of System Health and into Settings → Backup & Restore, and replace the spinning circle with a horizontal % progress bar that ticks through stages (0 → 100%).

## Changes

### 1. `src/components/system/DisasterRecoveryCard.tsx`
Refactor the in-card UX:
- Replace the `RefreshCw` spinner with the shadcn `<Progress />` bar.
- Drive progress via local state with stepped phases while `dr-replicate` runs (the edge function is one POST, no stream — so progress is simulated but realistic):
  - 0% Idle
  - 10% Connecting to fallback
  - 25% Mirroring auth users
  - 55% Ensuring storage buckets
  - 80% Copying files
  - 95% Finalising
  - 100% on success / reset on error
- A `setInterval` advances through the phases (every ~1.2s) until the mutation resolves, then snaps to 100% and clears. Show the current phase label + percentage above the bar.
- Keep the existing "last sync" report block (auth users, buckets, files, errors).
- Card heading remains the same; copy unchanged ("…02:30 IST… trigger a manual sync now").

### 2. `src/pages/SystemHealth.tsx`
- Remove the `<DisasterRecoveryCard />` render (line 381) and its import (line 22).

### 3. `src/components/settings/BackupRestore.tsx`
- Import and render `<DisasterRecoveryCard />` at the top of the page (above the existing backup/export sections), so it appears at `/settings?tab=backup`.

## Verification
- Visit `/settings?tab=backup` → DR card is visible (owner only).
- Click "Sync to fallback now" → button disables, progress bar animates 10% → 100% with phase labels, then shows the success summary.
- Visit `/system-health` → DR card is gone.
- No backend/edge function changes; `dr-replicate` continues to work as-is.
