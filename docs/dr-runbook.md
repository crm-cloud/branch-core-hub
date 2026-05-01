# Disaster Recovery Runbook — The Incline Life by Incline

**Scope:** active/passive failover from the primary stack to a standby stack. **No active-active writes. No automatic database failover.** Promotion is a deliberate, human-initiated procedure.

---

## 1. Architecture

```
                       ┌──────────────────────────────┐
   Members / Staff ──► │  Primary frontend            │
                       │  Lovable Cloud (incline.lovable.app, theincline.in)
                       └──────────────┬───────────────┘
                                      │  reads anon key from /app-config.json
                                      ▼
                       ┌──────────────────────────────┐
                       │  Primary Supabase (Project A) │
                       │  iyqqpbvnszyrrgerniog          │
                       │  - DB, Auth, Storage, Edge fns │
                       └──────────────┬───────────────┘
                                      │ nightly logical backup +
                                      │ storage object mirror (CLI)
                                      ▼
                       ┌──────────────────────────────┐
                       │  DR Supabase (Project B)     │
                       │  - holds dumps + objects     │
                       │  - dr_mode=true while idle   │
                       │  - anon key NOT distributed  │
                       └──────────────────────────────┘

   Standby frontend (Vercel / Cloudflare Pages) — built with VITE_APP_ENV=dr.
   Serves /app-config.json (no-store) pointing at Project B post-promotion.
```

---

## 2. RPO / RTO

| Metric | With Supabase PITR enabled | Logical-only (no PITR) |
|---|---|---|
| **RPO** (max data loss) | ~5 min | up to 24 h |
| **RTO** (time to restore) | 2–4 h | 2–4 h |

**Action:** confirm PITR is enabled on the Supabase plan. If not, the de facto RPO is 24 h and the runbook should call this out before declaring DR.

---

## 3. Pre-flight checklist

- [ ] PITR is enabled on Project A *(or 24 h RPO accepted)*.
- [ ] Project B is provisioned, **migrations applied**, edge functions deployed, but `dr_mode = true` and no client distribution of its anon key.
- [ ] DR backup ran successfully in the last 24 h (`dr-backup.yml` last run green).
- [ ] `verify.sh` was last run successfully.
- [ ] CI vault holds: `SUPABASE_ACCESS_TOKEN`, `PRIMARY_*`, `DR_*` secrets. **Service-role keys are never committed and never stored in `app-config.json`.**

---

## 4. When to declare DR

| Signal | Decide |
|---|---|
| Supabase Project A is in `INACTIVE`, `INIT_FAILED`, or `RESTORE_FAILED` for > 30 min and Supabase status page confirms an incident | Promote |
| Primary frontend host (Lovable) outage > 60 min and DNS check fails | Switch frontend only (DB still A) |
| Data corruption discovered on A | Promote *and* roll back via PITR before exposing B |
| Transient errors only | Do **not** promote — wait |

---

## 5. Failover procedure

### 5.1 Freeze writes on primary
If A is reachable:
```sql
UPDATE public.settings
SET value = jsonb_set(value, '{enabled}', 'true'::jsonb)
              || jsonb_build_object('reason','dr-failover','set_at', now()::text)
WHERE branch_id IS NULL AND key = 'dr_mode';
```
The `dr_block_writes` trigger now blocks writes from authenticated users **and** from production edge functions on: `invoices`, `payments`, `memberships`, `member_attendance`, `staff_attendance`, `rewards_ledger`, `wallet_transactions`, `benefit_bookings`, `benefit_usage`, `referrals`, `lockers`, `approval_requests`, `ecommerce_orders`. Only restore scripts that explicitly `SET LOCAL app.dr_restore = 'true'` are allowed through.

### 5.2 Restore into Project B
```bash
cd scripts/dr
./restore.sh --i-understand-this-overwrites
./verify.sh
./smoke-login.sh   # proves auth.users restored correctly
```
**Do not proceed unless all three exit 0.**

### 5.3 Switch frontend `app-config.json`
Build the DR mirror with:
```bash
VITE_APP_ENV=dr \
VITE_BUILD_SHA=$(git rev-parse --short HEAD) \
bun run build
```
This emits `dist/app-config.json` with `drMode:true` and Project B's anon key. Deploy to Vercel/Cloudflare Pages. The Flutter app fetches this URL on cold start (`Cache-Control: no-store`) and switches to Project B automatically.

### 5.4 Repoint webhooks (per provider)

| Provider | Where to update | New URL |
|---|---|---|
| **Razorpay** | Dashboard → Settings → Webhooks → edit existing | `https://<DR_PROJECT_REF>.functions.supabase.co/payment-webhook` |
| **Meta WhatsApp Cloud API** | developers.facebook.com → App → WhatsApp → Configuration → Callback URL + verify token | `https://<DR_PROJECT_REF>.functions.supabase.co/whatsapp-webhook` (verify token unchanged) |
| **MIPS devices** | Run `sync-to-mips` against B (it pushes new callback URLs to every device using `mips_device_inventory`) | `https://<DR_PROJECT_REF>.functions.supabase.co/mips-webhook-receiver` |
| **Round SMS** | RoundSMS Dashboard → DLR Settings | `https://<DR_PROJECT_REF>.functions.supabase.co/round-sms-dlr` |
| **Resend / email** | Resend Dashboard → Webhooks | `https://<DR_PROJECT_REF>.functions.supabase.co/email-webhook` |

### 5.5 Lift the freeze on B
```sql
UPDATE public.settings
SET value = jsonb_set(value, '{enabled}', 'false'::jsonb)
WHERE branch_id IS NULL AND key = 'dr_mode';
```

### 5.6 Notify
Send WhatsApp/SMS template `dr_failover_notice` to staff and members.

---

## 6. Post-promotion validation
- Member login on the DR frontend.
- Create a test invoice + record a test payment (use `record_payment` RPC).
- Trigger a Razorpay test webhook → confirm payment row written.
- Member check-in (member_attendance row).
- WhatsApp inbound → `whatsapp-webhook` handles + replies.
- File upload to a storage bucket from the admin app.

Log results into `dr_drill_log` (see §8).

---

## 7. Failback rule (conservative)

**Once Project B has accepted production writes, B is canonical.** Returning to A is a separate planned-maintenance operation:

1. Schedule a maintenance window.
2. Set `dr_mode=true` on B (freeze writes).
3. Take a fresh backup of B with `backup.sh`.
4. Restore that backup into A using `restore.sh`.
5. Run `verify.sh` and `smoke-login.sh` against A.
6. Switch `app-config.json` back to A; redeploy.
7. Lift the freeze.

Never attempt to merge A's stale state with B's newer writes. Always treat the active project as the source of truth and overwrite the other.

---

## 8. Quarterly DR drill — acceptance criteria

Each quarter, perform a full drill in a maintenance window. Record results in `dr_drill_log`. **Outcome = `pass` only when every checkbox below is true:**

- [ ] `db_restored` — `restore.sh` completed on B.
- [ ] `storage_restored` — every bucket round-tripped, `verify.sh` exits 0.
- [ ] `edge_functions_deployed` — all functions in `supabase/functions/` deployed to B.
- [ ] `app_config_switched` — DR frontend rebuilt with `VITE_APP_ENV=dr` and live.
- [ ] `member_login_ok` — `smoke-login.sh` plus a manual member login on the DR frontend.
- [ ] `invoice_create_ok` — staff creates an invoice on DR; row visible.
- [ ] `payment_webhook_ok` — Razorpay test webhook accepted; `payments` row appears.
- [ ] `attendance_ok` — member check-in via MIPS sandbox device hits `mips-webhook-receiver` on B.
- [ ] `whatsapp_webhook_ok` — Meta sandbox sends an inbound message; auto-reply fires.
- [ ] `storage_upload_ok` — admin uploads a file to a bucket on B and downloads it back.

Performer signs off in `dr_drill_log.notes`. Failback (§7) is part of the same drill.

---

## 9. Out of scope (V1)

- Active-active replication.
- Automatic DNS failover.
- Logical replication / CDC to B.
- Cloudflare WAF write blocking against `*.supabase.co` (writes are blocked via the in-database `dr_block_writes` trigger instead).
- Edge-function-driven `pg_dump` (the legacy `backup-export` JSON exporter remains for ad-hoc developer exports only — it is **not** the DR source of truth).

---

## 10. Operational sign-off

DR is **not operational** until every box on the in-app checklist
(`/dr-readiness`, table `public.dr_readiness_checklist`) is ticked with
evidence. The function `public.dr_is_operational()` returns `true` only
when all 10 rows are `completed = true`. The frontend uses this to flip
the DR Readiness badge from amber ("Not Yet Operational") to green
("DR Operational").

The 10 steps mirror the operational checklist exactly:

1. Provision Supabase Project B
2. Apply all migrations to Project B
3. Add GitHub Actions secrets
4. Run manual backup from primary
5. Restore into Project B
6. Run verify.sh and smoke-login.sh
7. Confirm PITR enabled (or accept 24h RPO)
8. Test dr_mode=true on critical write paths
9. Confirm app-config.json switch works
10. Complete one quarterly DR drill (record drill_log id as evidence)

Do not declare DR operational, do not announce it to staff, and do not
rely on the standby for incident response until the in-app checklist
shows the green "DR Operational" badge.
