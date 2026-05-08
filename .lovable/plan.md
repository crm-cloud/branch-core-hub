## Goal

Set up the connected secondary Supabase project as a true warm-standby of the current primary (`iyqqpbvnszyrrgerniog`) so that if the primary becomes unreachable, the live app automatically switches over with zero code redeploy. Nothing currently deployed changes behaviour — the fallback is dormant until needed.

## What gets mirrored

1. **Database** — `public` + `auth` + `storage` metadata (full pg_dump nightly).
2. **Storage object bytes** — every bucket (member docs, scans, attachments, announcements, etc.).
3. **Edge functions** — all ~80 functions deployed to the DR project too, with the same names.
4. **Secrets / integration credentials** — re-created on the DR project (WhatsApp, Razorpay, MIPS, Lovable AI, Resend, Round SMS, HOWBODY, Meta, Google, Gemini, etc.).

## Architecture

```text
            ┌──────────── PRIMARY (iyqqpbvnszyrrgerniog) ───────────┐
            │  Postgres • Auth • Storage • 80 edge fns • secrets    │
            └───────────────────────────────────────────────────────┘
                          │  nightly 02:30 IST
                          ▼  (GitHub Actions: backup → restore → verify)
            ┌──────────── FALLBACK (new ref) ───────────────────────┐
            │  Mirror of schema + data + objects + fns + secrets    │
            │  dr_mode = TRUE  → dr_block_writes trigger keeps it   │
            │  read-only until promoted                             │
            └───────────────────────────────────────────────────────┘

Browser app:
  primary client (default) ──── healthz every 60s ────► /healthz
                                  3 failures in a row
                                          │
                                          ▼
                         swap to fallback client + show banner
```

## Step-by-step plan

### Phase 1 — Wire DR credentials (no code change yet)
1. Request the following secrets via the secrets tool (you paste values):
   - `DR_PROJECT_REF`
   - `DR_SUPABASE_URL`
   - `DR_SUPABASE_ANON_KEY`
   - `DR_SERVICE_ROLE_KEY`
   - `DR_DB_URL`
   - `DR_BUCKET` (name of mirror bucket on DR project)
   - `SUPABASE_ACCESS_TOKEN` (personal access token for CLI)
2. Verify with `supabase--cloud_status` that primary is healthy before any sync.

### Phase 2 — Initial full sync (one-time)
3. Run `scripts/dr/backup.sh` against primary → produces `_dr-out/<ts>/` with `public.sql`, `auth.sql`, `storage.sql`, `storage-objects/*`, `manifest.json`.
4. On the DR project: enable `dr_mode=true` flag and the `dr_block_writes` trigger (already coded — apply via migration on DR ref only).
5. Run `scripts/dr/restore.sh --i-understand-this-overwrites` against DR_DB_URL (sets `app.dr_restore=true` inside txn so trigger lets writes through).
6. Mirror storage object bytes via `supabase storage cp -r` (already in restore.sh).
7. Deploy all edge functions to DR: loop `supabase functions deploy <name> --project-ref $DR_PROJECT_REF` for every dir under `supabase/functions/`.
8. Re-create runtime secrets on DR: I will list every secret currently in primary; you paste the same values into the DR project's function secrets via Supabase dashboard (one-time).
9. Run `scripts/dr/verify.sh` — diffs row counts and SHA-256 of every storage object. Fail loudly if mismatch.
10. Run `scripts/dr/smoke-login.sh` to prove `auth.users` was restored correctly.

### Phase 3 — Scheduled mirror
11. The existing `.github/workflows/dr-backup.yml` already runs nightly at 02:30 IST. Extend it to also:
    - call `restore.sh` against DR after backup,
    - run `verify.sh`,
    - post a Slack/log line on failure.
12. Add a second workflow `dr-functions-sync.yml` that on every merge to `main` redeploys changed edge functions to BOTH primary and DR.

### Phase 4 — Runtime auto-failover (the only app-side change)
13. Add `VITE_SUPABASE_FALLBACK_URL` and `VITE_SUPABASE_FALLBACK_ANON_KEY` to env (publishable values, safe in client).
14. Create `src/integrations/supabase/failoverClient.ts` — wraps the existing client; exposes `getActiveClient()` and a `useFailoverHealth()` hook.
15. Add `src/lib/dr/healthMonitor.ts` — singleton that pings `${PRIMARY_URL}/functions/v1/healthz` every 60s; after 3 consecutive failures (or any 5xx burst) flips a Zustand `useFailoverStore` flag.
16. Modify `src/integrations/supabase/client.ts` re-export only — internally route through `failoverClient`. **No service or component changes needed** because every file imports `{ supabase } from "@/integrations/supabase/client"`.
17. Add a top-of-app `<FailoverBanner />` (red strip): "Running on backup system — some writes may be temporarily disabled." Shown only when failover flag is true.
18. When in failover mode, respect the DR project's `dr_mode` — if it's still TRUE the user gets read-only; you (owner) can flip `dr_mode=false` via a one-click button on `/dr-readiness` to make DR writable.

### Phase 5 — Rollback safety
19. Switching back to primary: monitor auto-recovers — once `/healthz` returns 200 for 5 minutes the flag flips back. Manual override toggle on `/dr-readiness` page.
20. Document a "data drift" reconciliation step in `docs/dr-runbook.md` for any writes that happened on DR while primary was down (currently out of scope — DR stays read-only by default unless you explicitly promote it).

### Phase 6 — Verify nothing broke on primary
21. Build passes, all existing edge functions untouched on primary.
22. `useFailoverStore` defaults to `primary` → app behaves identically to today.
23. Manual smoke test: kill primary URL in DevTools (block request) → confirm banner appears + reads continue from DR.

## Files to add / change

**New:**
- `src/integrations/supabase/failoverClient.ts`
- `src/lib/dr/healthMonitor.ts`
- `src/lib/dr/useFailoverStore.ts` (Zustand)
- `src/components/dr/FailoverBanner.tsx`
- `.github/workflows/dr-functions-sync.yml`
- `scripts/dr/sync-functions.sh` — loops `supabase functions deploy` over all dirs
- `scripts/dr/initial-bootstrap.sh` — orchestrates phase-2 steps 3–9
- `supabase/migrations/<ts>_dr_enable_block_writes.sql` — applied **only against DR ref**, not primary
- `docs/dr-failover-runbook.md`

**Modified (minimal, safe):**
- `src/integrations/supabase/client.ts` — internal re-export through failover wrapper (public API unchanged)
- `src/App.tsx` — mount `<FailoverBanner />` once near the root
- `.github/workflows/dr-backup.yml` — chain restore + verify after backup
- `src/pages/DRReadiness.tsx` — add fallback health card + manual flip button
- `.env` (you, not me) — add `VITE_SUPABASE_FALLBACK_URL` + `VITE_SUPABASE_FALLBACK_ANON_KEY`

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Restore overwrites real DR data | `--i-understand-this-overwrites` flag + `dr_block_writes` keeps DR read-only |
| Edge functions on DR call primary URLs | Functions read `SUPABASE_URL` from env injected per project — no code change needed |
| Webhook URLs (Meta, Razorpay, MIPS) point only at primary | During failover you manually swap webhook URLs in those dashboards (documented in runbook). Out of scope for auto-switch. |
| Auth sessions break on swap | Both projects share the same `auth.users` rows after restore, but JWTs are signed with different keys → users will be asked to log in again on failover (acceptable RTO trade-off) |
| Secrets drift between projects | Quarterly checklist in runbook; future enhancement = secret-sync script |

## What this plan explicitly does NOT do

- No real-time replication (RPO = 24h by your choice).
- No automatic webhook URL swap on third-party providers.
- No automatic promotion of DR to writable — that stays a deliberate human action.
- No changes to current production behaviour until failover triggers.

After you approve, Phase 1 starts with a secrets request — you paste DR credentials, then I run the bootstrap.
