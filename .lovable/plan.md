# Automation Brain — fixes, Live-Feed wiring, UI cleanup, edge audit

## Problem recap

1. **Live Feed in Communication Hub doesn't show automated nudges.** `send-reminders` writes directly into `communication_logs` with no `channel` / `category` / `dedupe_key`, so the WA / SMS / Email / In-App tabs filter them out. `automation-brain` itself doesn't write a backlog row when a worker silently delivers via WhatsApp/email.
2. **Five rules are red in the Control Room:**
   - `Auto-Expire Memberships` → `aggregate functions are not allowed in RETURNING` (bug in `auto_expire_memberships()` SQL).
   - `Booking Reminders (T-2h)` & `Daily Reminders` → `HTTP 401 Unauthorized` (the `send-reminders` edge fn requires a user JWT; the brain calls it with the service-role token which `getClaims` rejects).
   - `Birthday Wishes` → `column members.name does not exist` (the worker uses the auto-gen FK alias `members_user_id_fkey`, which our own rules forbid).
   - `AI Lead Nurture` → `Function failed to start (BOOT_ERROR)` because `chatPlatform` is declared twice in `lead-nurture-followup/index.ts` (lines 182 + 204).
   - `Reconcile Payments` → `[object Object]` (error formatting bug; the underlying RPC exists).
3. **Notification Settings page** still shows the "Automation Brain" deep-link card the user wants removed, and the `LeadNotificationSettings` block needs to be re-styled to match the existing Email Notifications / System Alerts cards.
4. **Edge function audit** — now that one cron (`automation-brain-tick`) drives everything, several files exist only as workers or are fully obsolete and bloat the bundle.

---

## Plan

### 1. Make automated sends visible in Live Feed (single dispatcher)

- Refactor `send-reminders` so that **every** outbound message goes through `dispatchCommunication()` (`dispatch-communication` edge fn) instead of directly inserting into `communication_logs`. That guarantees `channel`, `category`, `dedupe_key`, member preferences and quiet-hours all get applied — and the rows show up in WA / SMS / Email / In-App tabs.
- Same change in `run-retention-nudges` (the only other place that still writes `communication_logs` directly) and in the built-in `birthday_wish` worker (already uses the dispatcher — keep, but fix the query).
- Allow `send-reminders` to be called by the Automation Brain (service-role) **and** by signed-in staff. Detection: if the bearer equals `SUPABASE_SERVICE_ROLE_KEY`, skip `getClaims` and treat the request as system-triggered (`callerId = 'system'`); otherwise keep the existing JWT + role check. This also fixes the 401s.
- Backfill a tiny migration that fills `category` / `channel` defaults on the recent NULL rows so the Live Feed counters reconcile.

### 2. Fix the five broken rules

- **`auto_expire_memberships`** — rewrite as:
  ```sql
  WITH upd AS (UPDATE memberships SET status='expired'
               WHERE status='active' AND end_date < CURRENT_DATE
               RETURNING 1)
  SELECT count(*) INTO v_count FROM upd;
  ```
- **`birthday_wish` (built-in worker in `automation-brain/index.ts`)** — drop the FK alias; do a two-step fetch:
  1. `select id, branch_id, user_id from members where status='active'`
  2. `select user_id, full_name, date_of_birth from profiles where user_id in (...)`
  Then join in JS. Filter by `mm-dd` from `date_of_birth`. (Also matches our own "no auto-gen FK alias" memory rule.)
- **`lead-nurture-followup`** — delete the duplicate `const chatPlatform = chat.platform || "whatsapp";` declared at line 182; keep the one at 204 (or hoist it once near 180 and remove the second). Wrap the outer `Deno.serve` in `try/catch` and route errors through `captureEdgeError` for the existing observability stack.
- **`reconcile-payments`** — change the catch to `JSON.stringify(err, Object.getOwnPropertyNames(err))` (or extract `err.message`/`err.details`/`err.code`) so the brain logs a useful string, not `[object Object]`.

### 3. Notification Settings page (`src/components/settings/NotificationSettings.tsx`)

- Remove the "Automation Brain" gradient card entirely (lines 186–211).
- Re-style the `<LeadNotificationSettings />` block to mirror Email Notifications / System Alerts: same `Card` shell, same icon-in-header pattern, same row layout (`Label` + helper text + `Switch`). Keeps a single visual rhythm of three side-by-side rounded-2xl cards (Email · System Alerts · Lead Notification Rules). The Save button stays at the bottom.
- Final layout:

  ```text
  ┌── Email Notifications ──┐  ┌── System Alerts ──┐
  └─────────────────────────┘  └────────────────────┘
  ┌── Lead Notification Rules (matched style) ──────┐
  └──────────────────────────────────────────────────┘
                              [ Save Preferences ]
  ```

### 4. Edge function audit & cleanup

After the brain consolidation, classify every function under `supabase/functions/`. Three buckets:

**Keep — actively used (workers, webhooks, RPCs, member-facing)**
`automation-brain`, `dispatch-communication`, `send-whatsapp`, `send-sms`, `send-email`, `send-message`, `send-broadcast`, `send-reminders`, `lead-nurture-followup`, `run-retention-nudges`, `reconcile-payments`, `process-comm-retry-queue`, `process-whatsapp-retry-queue`, `process-scheduled-campaigns`, `whatsapp-webhook`, `meta-webhook`, `meta-oauth-callback`, `meta-subscribe`, `meta-data-deletion`, `meta-diagnose`, `mips-proxy`, `mips-webhook-receiver`, `revoke-mips-access`, `sync-to-mips`, `howbody-*`, `payment-webhook`, `verify-payment`, `create-payment-order`, `create-razorpay-link`, `create-member-user`, `create-staff-user`, `create-owner`, `admin-create-user`, `contract-signing`, `deliver-scan-report`, `generate-fitness-plan`, `ai-auto-reply`, `ai-dashboard-insights`, `ai-generate-whatsapp-templates`, `manage-whatsapp-templates`, `capture-lead`, `webhook-lead-capture`, `score-leads`, `notify-booking-event`, `notify-lead-created`, `notify-staff-handoff`, `request-google-review`, `google-review-redirect`, `export-data`, `backup-export`, `backup-import`, `healthz`, `log-edge-error`, `fetch-image-url`, `check-expired-access`.

**Review — likely safe to delete (one-off / dev / superseded)**
- `check-setup` — only shows a few boots; old onboarding probe.
- `test-ai-provider`, `test-ai-tool`, `test-integration` — manual smoke-test functions never wired to UI.
- `mips-proxy` vs `sync-to-mips` — confirm one is unused.

For each file in this bucket I'll grep usage in `src/` + `supabase/functions/` before deletion. Anything with zero references gets deleted via `delete_edge_functions` and removed from `supabase/config.toml`.

**Archive (do not delete) — superseded but referenced in old migrations**
None expected; legacy cron migrations are already idempotent (use `cron.unschedule` guards), so the only persistent cron job is `automation-brain-tick`.

### 5. After deploy

- Run `automation-brain` once via "Run now" for each previously-red rule and verify `last_status='success'` in `automation_rules`.
- Open Communication Hub → Live Feed and confirm new automated rows show up under WA / SMS / Email / In-App with proper status badges.

---

## Files touched

**Edge functions**
- `supabase/functions/send-reminders/index.ts` — service-role bypass + dispatcher migration.
- `supabase/functions/run-retention-nudges/index.ts` — replace direct `communication_logs` insert with `dispatchCommunication`.
- `supabase/functions/automation-brain/index.ts` — rewrite birthday worker to two-step query.
- `supabase/functions/lead-nurture-followup/index.ts` — fix duplicate `chatPlatform`, add error capture.
- `supabase/functions/reconcile-payments/index.ts` — proper error serialisation.
- Delete the unused functions identified in the audit (after grep confirmation) + remove their blocks from `supabase/config.toml`.

**Migrations**
- One new migration: rewrite `auto_expire_memberships()` to use a CTE; backfill `channel`/`category` on the 4 NULL rows (best-effort, NULL-safe).

**UI**
- `src/components/settings/NotificationSettings.tsx` — drop Automation Brain card, restyle `LeadNotificationSettings` to match.
- `src/components/settings/LeadNotificationSettings.tsx` — minor wrapper change so it slots inside the same `Card` style as the other two boxes.

**Memory**
- Update `mem://index.md` Automation Brain core line: note that all reminder workers MUST go through `dispatchCommunication` (no direct `communication_logs` writes from automation workers — already covered by CI guard, just reinforce).

No new dependencies. No schema changes beyond the one CTE fix.