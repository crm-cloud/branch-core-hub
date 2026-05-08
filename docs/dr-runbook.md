# Disaster Recovery Runbook

_Last updated: May 2026 — simplified setup, no GitHub Actions._

## Overview

The Incline runs an **active / passive** DR model:

- **Primary**: `iyqqpbvnszyrrgerniog.supabase.co` (live database, all writes happen here)
- **Standby**: `pmznpbsahetwmogezhff.supabase.co` (read-only mirror, refreshed nightly)

The standby is kept fresh by the `dr-replicate` edge function, which runs every
night at **02:30 IST** via Supabase pg_cron. There is **no GitHub Actions**, no
shell scripts, and no secrets to coordinate manually.

## How the sync works

```
   ┌──────────────────────────────────┐
   │  pg_cron (job: dr-replicate-     │
   │  nightly, runs 21:00 UTC daily)  │
   └────────────────┬─────────────────┘
                    │ net.http_post  (header: x-dr-secret = SELECT public.dr_get_or_create_token())
                    ▼
   ┌──────────────────────────────────┐
   │  edge fn: dr-replicate (v1.1.0)  │
   │                                  │
   │  1. Validates x-dr-secret        │
   │     against private.dr_config    │
   │  2. Mirrors auth.users           │
   │  3. Mirrors storage buckets      │
   │  4. Copies object bytes          │
   └────────────────┬─────────────────┘
                    │ service-role key (DR_SERVICE_ROLE_KEY)
                    ▼
   ┌──────────────────────────────────┐
   │  STANDBY supabase project        │
   └──────────────────────────────────┘
```

### Key facts

| Item | Value / Location |
|---|---|
| Token storage | `private.dr_config` (single row, service-role only) |
| Token accessor (RPC) | `public.dr_get_or_create_token()` — service-role only |
| Edge function | `supabase/functions/dr-replicate/index.ts` |
| Cron job name | `dr-replicate-nightly` (visible in `cron.job` table) |
| Required runtime secret | `DR_SERVICE_ROLE_KEY` (the standby project's service-role JWT) |
| Manual trigger | **Settings → System Health → "Sync to fallback now"** (owner only) |

## Daily operations

### Verify last sync succeeded

1. Open **Settings → System Health** as an owner
2. Find the **Disaster Recovery** card
3. Click **Sync to fallback now**
4. Wait ~30–60s; the card shows a green ✅ with row counts and total bytes mirrored

### Inspect the cron history

```sql
SELECT runid, status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'dr-replicate-nightly')
ORDER BY start_time DESC
LIMIT 10;
```

### Reschedule the cron (rare)

```sql
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'dr-replicate-nightly';

SELECT cron.schedule(
  'dr-replicate-nightly',
  '0 21 * * *',  -- 21:00 UTC = 02:30 IST
  $cron$
  SELECT net.http_post(
    url := 'https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/dr-replicate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dr-secret', (SELECT public.dr_get_or_create_token())
    ),
    body := '{"mode":"all"}'::jsonb,
    timeout_milliseconds := 150000
  );
  $cron$
);
```

## Failover (true disaster)

**When to failover**: primary Supabase project is unreachable for >15 minutes
and Supabase status page confirms a regional outage.

### Steps

1. **Freeze writes on primary** (if reachable). This trips the `dr_block_writes`
   trigger to prevent split-brain:
   ```sql
   INSERT INTO settings (branch_id, key, value)
   VALUES (NULL, 'dr_mode', 'true'::jsonb)
   ON CONFLICT (branch_id, key) DO UPDATE SET value = EXCLUDED.value;
   ```
2. **Point the app to the standby**. Update DNS / hosting environment so
   `theincline.in` serves a build with:
   - `VITE_SUPABASE_URL=https://pmznpbsahetwmogezhff.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=<standby anon key>`
3. **Verify**: log in, check `/system-health`, confirm member list loads.
4. **Inform staff** that the system is in DR mode (the `DrBanner` component
   shows automatically when `dr_mode` is true).

### Coming back to primary

Once primary is healthy:

1. Take a fresh dump of the standby (any new writes that happened during DR).
2. Restore those deltas to primary using the `app.dr_restore = 'true'` session
   flag inside a single transaction (bypasses `dr_block_writes`).
3. Flip `dr_mode` back to `false`.
4. Repoint DNS to primary.
5. Trigger a fresh `Sync to fallback now` to re-establish the mirror.

## What the standby does NOT mirror

- Edge function code (~70 functions). If primary is permanently lost, the
  functions need to be redeployed to the standby project from this repo.
- Cron jobs / pg_cron schedules — must be recreated on the standby.
- Project-level secrets (Razorpay, Meta, etc.) — must be re-added to the standby.
- Custom roles / extensions — generally identical because both projects were
  provisioned from the same template, but verify before failover.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "unauthorized" from dr-replicate | Token not generated yet | Click **Sync to fallback now** once — first call creates the token |
| Cron runs but nothing mirrored | `DR_SERVICE_ROLE_KEY` missing or wrong | Update the secret in Lovable Cloud → Backend → Secrets |
| Sync succeeds but storage bytes = 0 | New buckets not yet ensured on standby | Re-run sync; `mode: "all"` ensures buckets first then objects |
| `private.dr_config` table missing | Migration not applied | Re-apply the DR migrations (search for `dr_get_or_create_token`) |

## Removed in May 2026

- `scripts/dr/backup.sh`, `restore.sh`, `verify.sh`, `smoke-login.sh` — replaced by the edge function
- `.github/workflows/dr-backup.yml` — replaced by Supabase pg_cron
- `vite-plugins/dr-assets.ts` — emitted `/healthz.json` and `/app-config.json` static files at build time; nothing in the app actually read them, the live `healthz` edge function makes them redundant
- `DR_REPLICATE_SECRET` runtime secret — replaced by self-managing `private.dr_config` token
