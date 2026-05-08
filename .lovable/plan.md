## Important clarification first

We did **not** remove DR. We removed only the *complicated bits*: the GitHub Actions pipeline and the shell scripts. The actual disaster-recovery system is still alive and well:

- ✅ `dr-replicate` edge function (nightly mirror, working — last sync: 5 users + 37 files)
- ✅ The `private.dr_config` token table + cron job
- ✅ `healthz` edge function
- ✅ `DrBanner` + `useDrMode` in the app
- ✅ The DR Supabase project itself

So when cleaning up, I have to be careful **not** to delete things that the working system still relies on, or files that are simply unrelated.

## What's safe to delete

| File / folder | What it is | Action | Why |
|---|---|---|---|
| `.github/workflows/dr-backup.yml` | The nightly pg_dump GitHub Action we just retired | **Delete** | Replaced by the inside-Supabase cron |
| `.github/workflows/ci.yml` | General CI (the direct-write guard, lint, tests) | **Keep** | Not DR-related; protects the codebase |
| `docs/dr-runbook.md` | The DR operations runbook | **Rewrite, don't delete** | DR still exists — runbook needs updating to match the new simpler setup, not deleted |
| `docs/bundle-strategy.md`, `communication-dispatcher.md`, `production-readiness.md`, `route-topology.md`, `workflows.md` | Other docs | **Keep** | Nothing to do with DR |
| `scripts/post-merge.sh` | Git hook helper | **Keep** | Not DR-related |
| `vite-plugins/dr-assets.ts` | Vite plugin emitting `/healthz.json` + `/app-config.json` at build time | **Delete** | Nothing in the app reads those JSON files; the live `healthz` edge function makes them redundant |
| `vite.config.ts` (lines 4 + 19-25) | Imports + uses `drAssets()` | **Edit** | Remove the import and the plugin call |
| `vite.config.ts.timestamp-*.mjs` (8 files you listed) | Stale esbuild temp files Vite leaves when the config errored mid-edit | **Already gone** | None exist in the project right now (`ls` returns 0). They're showing as open editor tabs but don't exist on disk. Closing those tabs is the only action — nothing for me to delete. |

## Final concrete change set

1. Delete `.github/workflows/dr-backup.yml`
2. Delete `vite-plugins/dr-assets.ts` (then `rmdir vite-plugins/` since it'll be empty)
3. Edit `vite.config.ts`:
   - Remove `import { drAssets } from "./vite-plugins/dr-assets";`
   - Remove the `drAssets({...})` call from the `plugins` array
4. Rewrite `docs/dr-runbook.md` to reflect the **new simpler reality**:
   - Nightly cron in Supabase pg_cron → calls `dr-replicate` edge fn
   - Token auto-managed via `private.dr_config` + `dr_get_or_create_token()` RPC
   - Manual sync via the "Sync to fallback now" button on System Health
   - Old shell scripts removed; no GitHub Actions involved
   - Failover steps (flip `dr_mode` flag, point DNS) — unchanged

## Things I will NOT touch

- The `dr-replicate` edge function
- The `healthz` edge function
- `private.dr_config` table or `dr_get_or_create_token()` RPC
- The cron job
- `DisasterRecoveryCard.tsx`, `DrBanner.tsx`, `useDrMode.ts`
- The DR Supabase project
- Any `docs/*.md` other than `dr-runbook.md`
- `.github/workflows/ci.yml`
- `scripts/post-merge.sh`

## After approval

Total damage: 2 files deleted, 1 folder removed, 1 file edited (vite.config.ts), 1 file rewritten (dr-runbook.md). ~30 seconds of work. The 8 stale `.mjs` editor tabs are phantoms — just close them.
