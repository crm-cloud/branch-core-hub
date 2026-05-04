
## Goals

Four connected fixes, ordered by user impact:

1. **Accounts Receivable shows ₹0** — bug fix
2. **Smarter automation cadences** — birthdays once, dues only on real trigger days
3. **Professional HTML email templates** — replace plain text with branded shell
4. **Enhanced Campaign Builder** — events, leads, members, promotions in one wizard, with auto-template generation + Meta approval handoff

---

## 1. Fix Accounts Receivable (Dashboard)

**Root cause** (verified via DB):
```
status     | count | outstanding
partial    |   2   |   24,000   ← excluded by current query
cancelled  |   6   |   30,800
```

`src/pages/Dashboard.tsx` line 227 only reads `status IN ('pending','overdue')`. All real outstanding dues are `partial`.

**Fix** (one line):
- Change filter to `.in('status', ['pending','overdue','partial','sent'])`
- Add a server-side `WHERE total_amount > coalesce(amount_paid,0)` guard so fully-paid `partial` rows never leak in
- The widget already renders `owed = total - paid`, so the math is correct once the rows are included

---

## 2. Smarter Automation Cadences (Automation Brain)

Today every rule runs on its cron and re-sends every tick. We make each worker idempotent **per business event**, not per cron tick.

**Rule cadence corrections** (in `automation_rules` seed + new migration):

| Rule | Old cron | New cron | Idempotency guard |
|---|---|---|---|
| `birthday_wish` | `30 9 * * *` | `30 9 * * *` (keep, once/day) | `dedupe_key = birthday:{member}:{YYYY-MM-DD}` (already in code — verify it blocks re-sends) |
| `daily_send_reminders` (dues) | `0 8 * * *` (sends every day) | `0 8 * * *` | New worker filter: only invoices where `due_date` is today, OR `due_date` was T-3, T-1, T+0, T+3, T+7 (configurable schedule). Skip otherwise. |
| `auto_expire_memberships` | `0 1 * * *` | keep | already idempotent |
| `benefit_t2h_reminders` | `*/30 * * * *` | keep | dedupe by booking id |
| `process_scheduled_campaigns` | `* * * * *` | keep |  |
| `lead_nurture_followup` | `0 * * * *` | `0 9-21 * * *` (business hours only) | already has per-lead cooldown |

**Implementation**:
- Add `reminder_schedule jsonb` column on `automation_rules` for the dues rule, default `{"offsets_days":[-3,-1,0,3,7]}`. UI in Automation Control Room exposes a chip selector.
- Update `send-reminders` invoice block: compute `daysUntilDue = due_date - today`. Only send if `daysUntilDue ∈ allowed_offsets`. Build dedupe key `payment_reminder:{invoice_id}:{daysUntilDue}` → `dispatch-communication` will dedupe.
- Birthday: confirmed dedupe key is already daily, so the once-a-day rule already protects against double-fires inside the same day. No change needed beyond verifying the cron expression format `30 9 * * *` matches single fire (it does — `nextCron()` jumps to next day).

---

## 3. Professional HTML Email Templates

**Today**: `send-email` has a `wrapInBrandedTemplate()` shell (dark + gold INCLINE branding) but it's **off by default** (`use_branded_template: false` in dispatch-communication). DB templates are mostly plain `\n` text.

**Plan**:
1. **Flip default to ON** in `dispatch-communication/index.ts` so every dispatched email gets the branded HTML shell.
2. **Rewrite the 16 email templates** in `templates` table via migration with rich HTML bodies:
   - Welcome, Payment Reminder, Payment Receipt, Renewal Reminder, Class Booking, Facility Booking, PT Session, Birthday, Feedback Request, Body Scan Ready, Posture Scan Ready, Plan Assigned (Diet/Workout), Invoice PDF, Receipt PDF, Staff Scan Alert
   - Each template uses semantic blocks: greeting, hero KPI/amount, CTA button, details table, footer note
   - All templates expect to be wrapped by the shell — they only contain the inner `<div class="body">` content
3. **Logo handling**: shell currently uses text logo. Add support for `<img src="{{logo_url}}">` where `logo_url` comes from `branches.logo_url` or falls back to text. Pass via `variables` from dispatcher.
4. **Footer**: keep "The Incline Life by Incline" + branch address + unsubscribe link (for marketing only — transactional skips unsubscribe per CAN-SPAM).

---

## 4. Enhanced Campaign Builder

**Today**: `CampaignWizard.tsx` is 3 steps (Audience → Message → Trigger). Audience supports members + segments only. No event metadata, no template auto-generation, no Meta approval loop.

**Target**: One wizard for **promotions, events, member broadcasts, lead nurture campaigns**, with optional auto-template-generation routed through `ai-generate-whatsapp-templates` and Meta submission.

### 4a. New "Campaign Type" pre-step
Replace step 1 with a type picker:
- **Promotion** (offer/discount) — auto-injects {{discount}}, {{offer_url}}
- **Event / Class** — fields: event title, date, venue, RSVP link → auto-injects {{event_name}}, {{event_date}}, {{event_time}}, {{rsvp_url}}
- **Announcement / Update** — generic
- **Lead Re-engagement** — audience defaults to `kind=leads, status=lost/cold`

Each type sets sensible defaults for channel, audience, and a starter message body.

### 4b. Audience expansion
`AudienceBuilder` already supports `audience_kind`. Surface clearly in UI:
- Members (with status/plan/branch filters) — existing
- Leads (with status/source filters) — already in resolver, expose chips
- Custom contacts (segments)
- Mixed (members ∪ leads ∪ contacts) — uses `resolve_campaign_audience` RPC

Show a live count badge per source ("142 members + 38 leads").

### 4c. Media handling (already partially done)
- Keep image/PDF/MP4 upload (16MB)
- Add **per-channel preview cards**: WhatsApp bubble, Email rendered with branded shell, SMS text-only with char count
- For events, add a **calendar `.ics` attachment** auto-generated from event date/time/venue → attached to email channel

### 4d. AI Template Generation + Meta Approval Loop (new)
A new toggle in step 2: **"Generate reusable WhatsApp template for this campaign"**.

Flow when ON:
1. Wizard calls `ai-generate-whatsapp-templates` with the campaign body + variables → returns a draft `templates` row (channel=whatsapp, status=pending)
2. Wizard shows a preview drawer with the AI-generated template (header, body, footer, buttons)
3. On confirm → submit to Meta via existing `manage-whatsapp-templates` edge fn → status flips to `submitted`
4. Campaign is saved with `linked_template_id`. If `trigger=send_now` and template is not yet `approved`, the wizard offers two options:
   - **Send as free-form session message** (24-hr window only)
   - **Wait for approval** (campaign status = `awaiting_template_approval`, `process-scheduled-campaigns` re-checks every minute and dispatches once approved)

A new column `campaigns.linked_template_id uuid REFERENCES templates(id)` plus `campaigns.template_status text` to track this.

### 4e. Communication Hub sync
Already done via `send-broadcast` → `dispatch-communication` (logs land in `communication_logs` with channel + category). Verify campaign sends appear in Live Feed by ensuring `category='marketing'` and `campaign_id` is in `delivery_metadata`.

### 4f. Cron + Instant
- **Send now** → existing path
- **Schedule** → existing `process-scheduled-campaigns` worker (already cron'd via Automation Brain)
- **Recurring** (new): cron expression input (e.g. "every Monday 10 AM") → saved as `automation_rules` row with `worker=edge:send-broadcast`, `worker_payload={campaign_id}`. Brain dispatches per cron.

---

## Technical Summary

**Migrations**:
- Add `automation_rules.reminder_schedule jsonb`
- Add `campaigns.linked_template_id`, `campaigns.template_status`, `campaigns.campaign_type`, `campaigns.event_meta jsonb`
- Reseed all 16 email rows in `templates` with HTML bodies
- Update `birthday_wish` rule cron note (no cron change, just docs)
- Update `lead_nurture_followup` cron to `0 9-21 * * *`

**Edge fn changes**:
- `dispatch-communication`: default `use_branded_template=true` for emails; pass logo_url + branch_name into variables
- `send-reminders`: filter invoice reminders by `daysUntilDue ∈ rule.reminder_schedule.offsets_days`; richer dedupe key
- `send-email`: shell accepts logo image variable, optional unsubscribe footer for marketing category
- `process-scheduled-campaigns`: handle `awaiting_template_approval` status (re-check + dispatch)

**Frontend**:
- `src/pages/Dashboard.tsx` (line 227): widen invoice status filter
- `src/components/campaigns/CampaignWizard.tsx`: new Type step, AI template toggle, per-channel preview, event metadata fields, recurring trigger
- `src/components/settings/AutomationsControlRoom.tsx`: surface `reminder_schedule` chip selector on the dues rule

**Files NOT changing**: `src/integrations/supabase/client.ts`, `types.ts` (auto-gen), `supabase/config.toml` project section.

---

## Out of scope (deferred)

- Edge function cleanup audit — most "cleanup candidates" (`check-setup`, `test-ai-tool`, `test-integration`, `test-ai-provider`) are still referenced by Settings diagnostic UIs. Keeping them is the right call. We'll revisit only if any becomes provably orphaned.
- Multi-language email templates
- A/B testing on campaigns
