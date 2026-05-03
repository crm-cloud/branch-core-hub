# Automation Brain + Control Room

Replace the scattered cron jobs with a single intelligent orchestrator and a Settings UI to control everything.

## Architecture

```text
                    ┌──────────────────────────────┐
   pg_cron (1 job)  │  automation-brain (edge fn)  │
   every 5 min ───► │  - reads automation_rules    │
                    │  - decides what's due        │
                    │  - dispatches tasks          │
                    └──────────┬───────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
   send-reminders     send-birthday-wishes    run-retention-nudges
   mark-no-show       process-campaigns       lead-nurture (AI)
   reconcile-*        retry-queues            ...
```

A **single master cron job** ticks every 5 minutes and calls `automation-brain`. The brain reads rows from a new `automation_rules` table, evaluates each rule's schedule (`next_run_at`), and dispatches the appropriate worker. Heavy/intelligent rules (lead nurture, retention, smart copy) flow through Lovable AI Gateway; deterministic ones (birthday, dues, no-show) just call the existing workers.

## What gets built

### 1. Database (migration)
- `automation_rules` table:
  - `id`, `branch_id` (nullable = global), `key` (e.g. `birthday_wish`, `payment_reminder`, `partial_payment_reminder`, `booking_reminder_t2h`, `renewal_invoice`, `retention_nudge`, `lead_nurture`, `no_show_marker`, `payment_reconcile`, `comm_retry`, `whatsapp_retry`, `scheduled_campaigns`)
  - `name`, `description`, `category` (engagement / billing / booking / lifecycle / system)
  - `cron_expression` (e.g. `0 9 * * *`) **or** `frequency` (`every_n_minutes`, `daily_at`, `weekly`, `monthly`)
  - `time_of_day`, `days_of_week[]`, `interval_minutes`
  - `is_active` boolean, `use_ai` boolean, `ai_tone` (friendly / formal / motivational)
  - `last_run_at`, `next_run_at`, `last_status`, `last_error`, `last_dispatched_count`
  - `target_filter` jsonb (e.g. `{"plan_status":"active","branches":["uuid"]}`)
- `automation_runs` table — execution history (rule_id, started_at, finished_at, status, dispatched, errors, sample_payload).
- RLS: owner/admin read+write; SELECT for managers (their branch).
- RPCs: `admin_run_rule_now(rule_key)`, `admin_toggle_rule(rule_key, active)`, `admin_update_rule_schedule(rule_key, payload)` — all guarded by `has_capability('manage_automations')`.
- Seed default rows for the 13 existing automations + new birthday rule.

### 2. Edge function `automation-brain` (new)
- Triggered by ONE cron job: `automation-brain-tick` every 5 min.
- For each active rule where `next_run_at <= now()`:
  1. Mark `automation_runs` row started.
  2. Call the matching worker (existing edge fn or new logic).
  3. For `use_ai = true` rules, fetch context (member name, due amount, last visit, plan), then call Lovable AI Gateway (`google/gemini-3-flash-preview`) to compose a personalised message; pass to `dispatch-communication` with the rule's event key.
  4. Update `last_run_at`, `next_run_at` (computed from cron/frequency), `last_status`, counters.
- Built-in worker for new `birthday_wish` (queries `members.dob` matching today, AI-personalised greeting if `use_ai=true`, else uses `birthday_wish` template).
- Built-in worker for `partial_payment_reminder` (queries invoices with `amount_paid < total_amount` aged N days).

### 3. Cron consolidation (migration)
- Disable the 12 existing per-feature cron jobs (keep `dr-health-probe-db` separate).
- Create one new job:
  ```sql
  select cron.schedule('automation-brain-tick','*/5 * * * *',
    $$ select net.http_post(
         url:='https://<ref>.supabase.co/functions/v1/automation-brain',
         headers:='{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
         body:='{}'::jsonb) $$);
  ```
- Existing edge functions stay as workers — only their trigger source changes.

### 4. Control Room UI (`/settings/automations`)
A new Settings tab "Automation Brain":

- **Top KPIs:** Active rules · Runs today · Failures (24h) · Messages dispatched (24h)
- **Rules table** (Vuexy card, rounded-2xl, colored status badges):
  - Columns: Name · Category · Schedule (human-readable: "Every day at 9:00 AM") · AI · Last run · Last status · Active toggle · Actions
  - Row click → right-side **Sheet drawer** "Edit Automation":
    - Name, description (read-only for system rules)
    - Frequency picker: `Every N minutes` / `Daily at HH:MM` / `Weekly on [days] at HH:MM` / `Custom cron`
    - Live cron preview + next 3 run times
    - Toggle: **Use AI Brain** (when on, message body is composed by AI using rule context + `ai_tone` selector)
    - Target filter editor (branch picker, simple plan filters)
    - Active toggle, **Run now** button, **View history** (last 20 runs with status + dispatched count)
- **Add Custom Rule** button → same drawer, lets owner create a new AI-driven nudge (e.g. "weekly motivation message every Monday 8 AM, AI tone = motivational, segment = active members").
- **Run history panel** at bottom — global stream of last 50 `automation_runs`.

### 5. Fix the PDF template error (in same pass)
- Update `ai-generate-whatsapp-templates`: PDF/receipt/invoice events emit `header_type='none'` with a `{{document_link}}` body variable. Dispatcher already attaches the PDF as a separate document message at runtime.
- `manage-whatsapp-templates`: reject `header_type=document` without a real Meta media handle and return a clear error instead of forwarding to Meta.

## Files

**New**
- `supabase/migrations/<ts>_automation_brain.sql` (tables, RPCs, seed, cron swap)
- `supabase/functions/automation-brain/index.ts`
- `src/pages/settings/AutomationsControlRoom.tsx`
- `src/components/automations/AutomationRuleDrawer.tsx`
- `src/components/automations/CronFrequencyPicker.tsx`
- `src/components/automations/AutomationRunHistory.tsx`
- `src/services/automationService.ts`

**Edited**
- `src/pages/Settings.tsx` (add tab/route)
- `src/config/menu.ts` (Settings sub-entry)
- `supabase/functions/ai-generate-whatsapp-templates/index.ts`
- `supabase/functions/manage-whatsapp-templates/index.ts`
- `mem://index.md` (add Automation Brain memory)

## Behaviour summary

- One brain, one tick, all rules in one screen.
- Owners can pause any automation, change frequency, or flip "Use AI" without code.
- AI is opt-in per rule — transactional reminders stay deterministic; engagement/retention/birthday can be AI-personalised.
- Existing workers remain untouched — only the dispatch source changes from per-feature cron to the brain.
- PDF template Meta error fixed in the same release.
