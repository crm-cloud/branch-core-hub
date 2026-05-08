## Goal

Make the disaster-recovery sync **dead simple**:
- One nightly cron (already running, inside Supabase — no GitHub Actions).
- Zero secrets to coordinate (no `DR_REPLICATE_SECRET` to keep in sync between two places).
- Same end result: live database → DR backup, every night at 02:30 IST.

You keep the warm-standby project you've already paid for, but you stop babysitting passwords and external pipelines.

## What changes

### 1. Remove the shared-secret dance

Today: the edge function and the cron job both need to know the same `DR_REPLICATE_SECRET`. They drifted, sync fails with 401.

New: the function generates its own secret on first boot, stores it in a private database row, and the cron reads from the same row at run time. They can never drift again.

```text
   ┌─ first boot ─┐
   │ edge fn      │──── stores random token ───►  private.dr_config (1 row)
   └──────────────┘                                          ▲
                                                             │ reads token
   ┌─ every night 02:30 IST ─┐                              │
   │ cron                    │──────────────────────────────┘
   └─────────────────────────┘
```

After this change: I can delete the `DR_REPLICATE_SECRET` runtime secret entirely. Nothing for you to manage.

### 2. Delete the GitHub Actions path

The `scripts/dr/` shell scripts (backup.sh, restore.sh, verify.sh, smoke-login.sh) and their README will be removed. They were the "enterprise" path. We don't need them — Supabase's pg_cron + the edge function does the same job from inside Supabase, with no external CI to maintain.

Daily Postgres snapshots that Supabase already takes (free, automatic, 7-day retention) cover schema-level backups. Our edge function adds the cross-project mirror on top.

### 3. Add a one-click "Run sync now" button

In `Settings → System Health` (or a new `Settings → Disaster Recovery` card), add a button visible only to Owner role: **"Sync to fallback now"**. It triggers the same edge function on demand. Useful before risky migrations or if you want to verify freshness.

### 4. Keep what already works

- ✅ The `dr-replicate` edge function (the actual data-mirroring code) — keep
- ✅ The nightly 02:30 IST cron — keep, just rewrite it to fetch the token from the DB
- ✅ The `dr_block_writes` trigger on the DR project (prevents accidental writes to the standby) — keep
- ✅ The `DrBanner` component + `useDrMode` hook (in-app warning if you're on the DR site) — keep
- ✅ The `healthz` edge function — keep

## Files touched

| File | Action |
|---|---|
| `supabase/functions/dr-replicate/index.ts` | Update: read/write token from `private.dr_config` instead of env var |
| New migration | Create `private.dr_config(token text)` table, owner-only RLS |
| Cron schedule (via insert tool, not migration) | Rewrite to `SELECT token FROM private.dr_config` inside the http_post call |
| `scripts/dr/` folder | Delete entirely (5 files + README) |
| `src/components/system/` (or wherever System Health lives) | Add "Sync to fallback now" button card |
| `DR_REPLICATE_SECRET` runtime secret | Delete from project secrets — no longer used |

## What you do after I implement

Nothing. The first time the new function runs (cron or button), it generates its own token. Cron picks up the same token. Sync runs nightly forever.

Optional: hit the new "Sync to fallback now" button once to confirm it works. We'll see the green ✅ row count parity within ~30 seconds.

## What this does NOT cover (intentionally)

- **Sub-minute data loss** — if you need streaming replication, standard Supabase doesn't offer cross-project. This stays nightly.
- **Auto-failover on the live site** — the `DrBanner` shows up if the DB flag is flipped, but flipping it is a manual decision (correctly so — you don't want a transient outage to flip your whole app to read-only).
- **Edge function code mirroring to the DR project** — out of scope for this round. If primary dies, DR has the data but not the ~70 edge functions. Adding that needs the Supabase Management API access token, a separate one-time deploy script. Can do it next round if you want.

## Technical notes (for me)

- `private.dr_config` is a one-row table in a `private` schema with no public RLS grants — only the function (service role) and Postgres superuser can read it.
- Function flow: `SELECT token FROM private.dr_config` → if NULL, generate `gen_random_uuid()::text` and insert it. Then validate request header against that value.
- Cron uses `(SELECT token FROM private.dr_config)` inline in the `jsonb_build_object` for headers.
- All atomic via existing `cron.schedule` reschedule pattern.
