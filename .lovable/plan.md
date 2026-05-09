# Retention Campaign — Make Tests Real & Align with AI Template Manager

## Problems found

1. **Test buttons are fake.** `RetentionCampaignManager.handleTestSend` just opens `wa.me` / `sms:` / `mailto:` links in a new tab — it never goes through our backend, so it's not a real delivery test and gives no feedback about template approval, channel coverage, or member preferences.
2. **Live retention sender bypasses the dispatcher.** `supabase/functions/run-retention-nudges` calls `send-whatsapp` directly and writes raw rows into `communication_logs` for SMS/Email. This violates the Core rule "all outbound comms must go via `dispatchCommunication` / `dispatch-communication`" — it's why WhatsApp messages get rejected (no Meta-approved template, no language code, no `event_key`) and why SMS/Email never actually send.
3. **No CRM template for the retention stages.** `src/lib/templates/systemEvents.ts` only has `retention_nudge_t1/t2` and `win_back_30d`. The 3 stages shown in the UI (`Stage 1: Value Add`, `Stage 2: …`, `Stage 3: …`) have no entry in the canonical event catalog, so the Templates Hub Coverage matrix and the AI generator skip them — meaning Meta has nothing approved to send.

## Fix plan

### 1. Register the 3 retention stages in the canonical event catalog
File: `src/lib/templates/systemEvents.ts`
- Add events `retention_stage_1`, `retention_stage_2`, `retention_stage_3` (category `retention`, channels `whatsapp/sms/email/in_app`) with the body variable `{{member_name}}`.
- This automatically surfaces them in Templates Hub → Coverage matrix and in the AI Generator drawer (which auto-defaults to all missing events and upserts `whatsapp_triggers` rows on save).

### 2. Refactor `run-retention-nudges` to use the dispatcher
File: `supabase/functions/run-retention-nudges/index.ts`
- Remove the direct `send-whatsapp` fetch and the direct `communication_logs` insert.
- For each `channels[]` entry, call the canonical `dispatch-communication` edge fn with:
  - `event_key`: `retention_stage_${matchedTemplate.stage_level}`
  - `channel`: `whatsapp` | `sms` | `email`
  - `category`: `retention`
  - `member_id`, `branch_id`
  - `variables`: `{ member_name: member.full_name }`
  - `fallback_body`: the personalized `message_body` (so SMS/Email still work even before a template is approved)
  - `dedupe_key`: `buildDedupeKey(['retention', stage, member_id, channel])`
- Dispatcher already handles dedupe, member channel/category preferences, quiet hours, provider routing, and `communication_logs`.
- Keep the existing cooldown + reset guards and the `retention_nudge_logs` insert (mark log status from dispatcher result).

### 3. Make the Test buttons send real messages
File: `src/components/settings/RetentionCampaignManager.tsx`
- Replace `handleTestSend` (mailto / wa.me / sms:) with a small "Send test" flow:
  - Add a single inline "Test recipient" picker per stage card: a member-search Combobox (defaults to the logged-in user / their staff phone+email if available).
  - On click, call `dispatchCommunication({ event_key: 'retention_stage_${stage}', channel, category:'retention', member_id|recipient_phone|recipient_email, variables:{ member_name: chosen.name }, fallback_body: messageBody, dedupe_key: 'retention-test:${stage}:${channel}:${Date.now()}' })`.
  - Toast: success (with `dispatch_id`) or the dispatcher error verbatim (template-not-approved, opted-out, quiet-hours, etc.) so the admin sees exactly why a real send would be rejected.
- Disable channel test buttons whose dispatcher coverage check returns "not configured" (cheap pre-check via the `event_key` / channel pair).

### 4. One-click "Generate AI templates" CTA
File: `src/components/settings/RetentionCampaignManager.tsx`
- Add a header button `Generate WhatsApp Templates with AI` that opens the existing `AIGenerateTemplatesDrawer` filtered to `retention_stage_1|2|3`. The drawer already calls `ai-generate-whatsapp-templates` and upserts `whatsapp_triggers`, so once the admin clicks Save, Meta-approved templates exist and the WhatsApp Test stops failing.
- Show a small per-stage badge: "WA template: ✅ approved / ⏳ pending / ❌ missing" pulled from `whatsapp_triggers` + `meta_templates` for that `event_key`.

### 5. SMS + Email coverage
- Mirror the same event keys in the SMS and Email Coverage tabs (already automatic once step 1 lands — no extra code).
- Email body: dispatcher will fall back to the textarea body wrapped in the standard transactional layout; subject = `Stage {n}: {stage_name}`.
- SMS: dispatcher handles 160-char trimming and DLT mapping per existing rules.

## Out of scope
- No DB schema changes (`retention_templates`, `retention_nudge_logs` stay as-is).
- Cron schedule for `run-retention-nudges` unchanged.
- AI Studio prompt tweaks not required — the existing AI generator already handles `category:'retention'` events.

## Files to touch
- `src/lib/templates/systemEvents.ts` — add 3 events.
- `supabase/functions/run-retention-nudges/index.ts` — route through `dispatch-communication`.
- `src/components/settings/RetentionCampaignManager.tsx` — real Test sends + AI Generate CTA + coverage badges.

## Verification
1. Open Settings → Marketing & Retention, click `Generate WhatsApp Templates with AI`, save — confirm 3 rows appear in `whatsapp_triggers` for the new event keys.
2. Click **Test WhatsApp** on Stage 1 with own phone — message arrives via Meta template, log row in `communication_logs` has `event_key='retention_stage_1'` and `dedupe_key`.
3. Click **Test SMS** and **Test Email** — both deliver, dispatcher logs success.
4. Manually invoke `run-retention-nudges` (Run Now from Automation Brain) — `retention_nudge_logs` rows created, `communication_logs` written by dispatcher, no direct inserts.
5. Confirm CI direct-write guard still passes (we removed the only offending insert).
