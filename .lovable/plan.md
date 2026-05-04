## Scope

Two things to do:
1. **Audit** every place we expose automations/cron in the UI and consolidate.
2. **Fix** outstanding errors (Meta PDF template rejections, worker failures surfaced by Automation Brain).

---

## A. UI/UX Audit — Automation/Cron Surfaces Today

| # | Location | Component | What it does | Verdict |
|---|---|---|---|---|
| 1 | `Settings → Automation Brain` | `AutomationsControlRoom.tsx` | KPIs, 13 system rules, toggle/edit cron, Run Now, run history | ✅ Canonical control room |
| 2 | `Settings → Notifications → "Automated Reminders"` | `NotificationSettings.tsx` (RunRemindersButton) | Manual “Run Reminders Now” calling old `send-reminders` fn | ⚠️ Duplicate/legacy — confuses the user |
| 3 | `Settings → Notifications → "Lead Notification Rules"` | `LeadNotificationSettings.tsx` | Per-branch toggle matrix for lead SMS/WA alerts | ✅ Keep — this is config, not cron |
| 4 | `Settings → Communication Templates → WhatsApp → Automations` | `WhatsAppAutomations.tsx` | Map event → template (trigger registry) | ✅ Keep — different concern (template mapping) |
| 5 | `Settings → Reminders` (per-branch reminder config) | existing reminder mapping UI | Per-branch reminder enable map | ✅ Keep — config layer |

**Action:** Replace the standalone "Automated Reminders" card in Notification Settings with a **single deep-link card** ("Manage Automations →") that routes to `Settings?tab=automations`. The old `RunRemindersButton` becomes redundant because the Brain already has per-rule "Run Now" + a global tick.

---

## B. Fixes

### B1. Meta document/PDF template rejections (root cause)
`ai-generate-whatsapp-templates` currently emits `header_type='document'` with a placeholder URL → Meta rejects ("sample not provided"). Dispatcher v1.6.0 already injects the real PDF at send-time via a body variable, so the header is unnecessary.

**Fix in the prompt + tool schema:**
- For document-bearing events (`invoice_generated`, `receipt_generated`, `pos_order_pdf`, `scan_report_ready`, `diet_plan_pdf`, `workout_plan_pdf`, `contract_signed`) → force `header_type='none'`, append a `{{document_link}}` body variable, and add `document_link` to `variables`.
- Strip `header_sample_url` for these events.
- Add explicit rule lines in WhatsApp + Email system prompts.

### B2. AI-Generate Drawer auto-fill of missing templates
`Auto-fill (0)` was empty because the drawer was loading only the previously hard-coded list. Fix:
- Compute "missing" by diffing `getEventsForChannel(channel)` (canonical catalog) against existing templates in DB; default the selection to that diff so Auto-fill always has a target set.
- Add a small "Generate all missing" button that selects everything missing and generates in batches of 15.

### B3. Worker errors surfaced by Automation Brain
After the consolidation migration the brain calls these workers. Audit & repair:
- `lead-nurture-followup` — verify body schema, branch scoping, dispatcher import path.
- `process-comm-retry-queue` / `process-whatsapp-retry-queue` — confirm they boot OK (logs show boot but no work — fine).
- `send-reminders` — keep as worker for `daily_send_reminders` rule, but stop exposing a manual button.

For each, add try/catch + structured `log_error_event` so failures land in System Health.

### B4. WhatsApp Automations — already supports insert
`WhatsAppAutomations.tsx` already has `addMutation` + insert form. Add a small UX polish: pre-populate the event dropdown from `systemEvents.ts` and disable events that already have a row.

---

## C. Files to change

**Edge functions**
- `supabase/functions/ai-generate-whatsapp-templates/index.ts` — prompt + schema fix for documents (B1).
- `supabase/functions/lead-nurture-followup/index.ts` — wrap + log errors (B3).
- (No change to `automation-brain` — already correct.)

**Frontend**
- `src/components/settings/NotificationSettings.tsx` — remove `RunRemindersButton` card; replace with a deep-link card to Automation Brain.
- `src/components/settings/AIGenerateTemplatesDrawer.tsx` — diff against canonical catalog, default-select missing events, add "Generate all missing" CTA.
- `src/components/settings/WhatsAppAutomations.tsx` — populate event dropdown from `systemEvents.ts`, disable events already mapped.
- `src/lib/templates/systemEvents.ts` — tag document-bearing events with `attachment_kind: 'document'` so the AI generator can branch on it.

**Memory**
- Update `mem://index.md` Comms Hub line to reflect: (a) document events use `{{document_link}}` not header, (b) Notification Settings no longer hosts "Run Reminders", (c) Automation Brain is the single cron control room.

---

## D. Out of scope
- Building a new cron UI — Automation Brain already covers it.
- Touching `auth.*` / `storage.*` / `realtime.*` schemas.
- Re-architecting the dispatcher (already v1.6.0, handles document fallback).

---

## E. Acceptance
1. Generating templates for invoice/receipt/PDF events no longer produces `header_type='document'` proposals — they pass Meta review.
2. AI Drawer "Auto-fill missing" shows a non-zero count whenever the catalog has events without a saved template.
3. Notification Settings shows one card pointing to Automation Brain — no duplicate "Run Reminders" button.
4. Automation Brain run history shows `success` for `lead_nurture_followup` rule (or a clear logged error in System Health, not silent).
5. Adding a WhatsApp automation only lets you pick events that don't already have a trigger row.
