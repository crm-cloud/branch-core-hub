# Disaster Recovery V1 — Active/Passive (Approved with adjustments)

Active/passive only. No active-active writes. No automatic DB failover. Backups via Supabase CLI / GitHub Actions, not Edge pg_dump.

## Adjustments applied
1. Active/passive only — confirmed.
2. UI banner + disabled buttons **and** server-side write-block trigger on: `invoices, payments, memberships, member_attendance, staff_attendance, rewards_ledger, wallet_transactions, benefit_bookings, benefit_usage, referrals, lockers, approval_requests, ecommerce_orders`. Trigger bypasses for `service_role` only (so restore + service ops work).
3. `app_settings` does not exist. Use existing key/value `public.settings` table with global row `(branch_id NULL, key='dr_mode', value={enabled, reason, set_at, set_by})`.
4. Public `/healthz` returns only `{ status, env, version, latency_ms }`. Detailed `checks.{db,auth,storage}` only when caller is `service_role` or an authenticated owner/admin.
5. Backups via `scripts/dr/*.sh` + GitHub Actions using Supabase CLI. Existing `backup-export` retained as secondary developer convenience only.
6. `verify.sh` walks DR storage bucket, downloads each object, computes SHA-256, and compares against the backup manifest.
7. Auth restore proven by dry-run into Supabase B + automated login smoke test (`scripts/dr/smoke-login.sh`).
8. `system_health_pings` and `dr_probe` writes go through a `SECURITY DEFINER` RPC `record_health_ping(...)`, granted to `service_role` only — pg_cron call uses the RPC, sidestepping RLS-from-cron concerns.
9. Failback rule: once Supabase B receives any production writes, **B is canonical**. Returning to A requires a planned maintenance window with delta export from B → A and re-verify; documented in runbook.
10. Quarterly drill acceptance criteria stored as boolean columns on `dr_drill_log` (db_restored, storage_restored, edge_functions_deployed, app_config_switched, member_login_ok, invoice_create_ok, payment_webhook_ok, attendance_ok, whatsapp_webhook_ok, storage_upload_ok). All true ⇒ outcome=`pass`.

## Files to create
- **Migration** `supabase/migrations/<ts>_dr_mode_and_health.sql`
  - `is_dr_readonly()` SECURITY DEFINER reading `settings` row.
  - `dr_block_writes()` trigger function + attach BEFORE INSERT/UPDATE/DELETE on the 13 critical tables. Service-role bypass.
  - Insert `settings` row `dr_mode = { enabled:false, ... }`.
  - Tables: `system_health_pings`, `dr_probe`, `dr_drill_log` with RLS (owner/admin SELECT, service_role INSERT). RPC `record_health_ping(...)` SECURITY DEFINER granted to service_role.
  - pg_cron job `dr-health-probe-db` every 5 min calling `record_health_ping('db','ok',...)`.
- **Edge function** `supabase/functions/healthz/index.ts` — public minimal payload; detailed checks only for service_role / owner / admin. `verify_jwt = false` (config.toml block added).
- **Frontend**
  - `src/lib/runtime/host.ts` — `getRuntimeEnv()` from `VITE_APP_ENV`, `getBuildSha()`.
  - `src/hooks/useDrMode.ts` — TanStack query reading `settings` `dr_mode` row; exposes `{ isReadOnly, reason, assertWritable() }`.
  - `src/components/system/DrBanner.tsx` — sticky top banner shown when `env==='dr'` or `isReadOnly`.
  - Mount `DrBanner` in `src/App.tsx`.
  - `vite.config.ts` build-time plugin `dr-assets` emitting:
    - `public/healthz.json` → `{ status:'ok', env, version: <git sha or pkg version>, builtAt }`
    - `public/app-config.json` → `{ supabaseUrl, supabaseAnonKey, env, minAppVersion, drMode:false, supportEmail }`
- **Hosting fallbacks**
  - `vercel.json` — SPA rewrite, `Cache-Control: no-store` for `/app-config.json` and `/healthz.json`, security headers.
  - `netlify.toml` — equivalent.
  - `public/_headers` and `public/_redirects` for Cloudflare Pages.
- **DR scripts** (`scripts/dr/`)
  - `backup.sh` — uses `supabase db dump` (`--schema public`, then `--schema auth --schema storage`), then `supabase storage cp` to mirror object bytes to DR bucket. Writes manifest with row counts + SHA-256.
  - `restore.sh` — restores `auth` → `storage` metadata → `public` data into project B. Requires `--i-understand-this-overwrites`.
  - `verify.sh` — row-count + checksum diff between A and B; fails on mismatch.
  - `smoke-login.sh` — creates a throwaway test user on B and asserts sign-in works (proves Auth restore).
  - `README.md` — usage, env vars (`SUPABASE_ACCESS_TOKEN`, `PRIMARY_PROJECT_REF`, `DR_PROJECT_REF`, `DR_BUCKET`), explicit warning that service_role keys live only in CI/vault.
- **CI** `.github/workflows/dr-backup.yml` — nightly 02:30 IST; secrets from GitHub repo secrets only.
- **Runbook** `docs/dr-runbook.md`
  - Architecture diagram, **RPO/RTO** (5 min with PITR / 24 h logical-only; RTO 2–4 h).
  - Failover steps including DR-mode flip via `settings` row.
  - Per-provider webhook switch steps: **Razorpay**, **Meta WhatsApp Cloud API**, **MIPS** (push via existing `mips-*` functions), **Round SMS**, **Resend**.
  - Auth restore section + dry-run + login smoke test.
  - Failback rule: B becomes primary post-promotion; A returns only after planned maintenance + delta merge + re-verify.
  - Quarterly drill checklist mirroring `dr_drill_log` columns; sign-off table.

## Out of V1 scope (explicit)
Active-active replication, automatic DNS failover, logical replication to B, Cloudflare WAF write blocking, edge-function pg_dump.
