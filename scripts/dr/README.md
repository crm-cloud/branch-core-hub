# DR Scripts

CLI-based, run **outside** Supabase Edge. Requires:
- `supabase` CLI ≥ 1.180
- `psql`, `jq`, `curl`, `openssl`, `sha256sum` on PATH
- A vault / GitHub Actions encrypted secrets environment to inject credentials

## Required secrets (per environment)

| Variable | Where it lives | Notes |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | CI vault | Personal access token. Never commit. |
| `PRIMARY_PROJECT_REF` / `DR_PROJECT_REF` | CI vault | Project refs (public). |
| `PRIMARY_DB_URL` / `DR_DB_URL` | CI vault | Postgres URLs with service-role privileges. |
| `DR_BUCKET` | CI vault | Bucket on DR project that receives mirror dumps + objects. |
| `DR_SUPABASE_URL` / `DR_SUPABASE_ANON_KEY` / `DR_SERVICE_ROLE_KEY` | CI vault | Used by `smoke-login.sh`. Anon key only published in `app-config.json` *after* promotion. |

## Files

- `backup.sh` — nightly/manual logical backup of `public`, `auth`, `storage` schemas + storage object bytes; writes manifest with row counts and SHA-256.
- `restore.sh` — restores into the DR project. Each restore transaction sets `SET LOCAL app.dr_restore = 'true'` so writes pass the `dr_block_writes` trigger. Refuses to run without `--i-understand-this-overwrites`.
- `verify.sh` — diff row counts on critical tables AND SHA-256 of every storage object across A vs B.
- `smoke-login.sh` — proves `auth.users` restored correctly by creating + signing in a throwaway user, then deleting it.

## Important

The `dr_block_writes` trigger only honours the `app.dr_restore` GUC. **Production edge functions must never set this flag.** Only the restore scripts above set it inside their explicit transaction, and only with `SET LOCAL` (scoped to the txn).
