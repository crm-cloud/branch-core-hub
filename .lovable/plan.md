# Templates Hub — Coverage, Auto-Automations, AI Agent Cleanup

## Problem

1. The **Coverage & AI** matrix only lists 14 hand-picked system events, so "Auto-fill missing" shows `(0)` even though many real-world templates are missing — birthday, diet/workout plan PDF, retention, lead-nurture follow-up, booking confirmations, overdue, POS receipt, invoice/receipt PDFs, class schedule, benefit consumed, etc.
2. AI generation saves WhatsApp templates and submits to Meta, but does **not** create the `whatsapp_triggers` row, so the event is never auto-fired even after approval.
3. **AI Agent** sub-tab is duplicated under Templates → WhatsApp; it belongs in its own settings area, not in the templates hub.

## Plan

### 1. Single source of truth for system events

Create `src/lib/templates/systemEvents.ts` exporting one canonical catalog used by `TemplateCoverageMatrix`, `AIGenerateTemplatesDrawer`, and `WhatsAppAutomations`. Each entry has: `event`, `label`, `category` (lifecycle / billing / booking / engagement / retention / lead / marketing / document), `channels` (which of whatsapp/sms/email apply), optional `header_hint` (image/document/video) and `description`.

New catalog (~30 events):

```text
lifecycle      member_created, membership_expiring_7d, membership_expiring_1d,
               membership_expired, membership_overdue, freeze_confirmed,
               unfreeze_confirmed
billing        payment_received, payment_due, invoice_generated (PDF),
               receipt_generated (PDF), pos_order_completed (PDF)
booking        class_booked, class_reminder_24h, class_schedule_weekly,
               facility_booked, facility_cancelled, pt_session_booked,
               pt_session_reminder, benefit_consumed, benefit_low_balance
engagement     birthday, missed_workout_3d, body_scan_ready,
               diet_plan_ready (PDF), workout_plan_ready (PDF)
retention      retention_nudge_t1, retention_nudge_t2, win_back_30d
lead           lead_created, lead_nurture_followup, lead_welcome
marketing      class_promo (image), offer_announcement (image),
               gym_closure_update, monthly_newsletter (email-only)
```

Drop the local `SYSTEM_EVENTS`, `COMMON_EVENTS`, and `EMAIL_EXTRA` arrays in favour of `getEventsForChannel(channel)`.

### 2. Coverage matrix uses the new catalog

`TemplateCoverageMatrix.tsx`:
- Render every event the catalog allows for the active channel.
- Now `(missingEvents.length)` reflects the real gap, so the "Auto-fill missing with AI (N)" button finally has work to do.

### 3. AI save → auto-create automation

In `AIGenerateTemplatesDrawer.submitOne` (after the local insert succeeds, channel=whatsapp):

```ts
// Upsert a default automation so the event actually fires
await supabase.from('whatsapp_triggers').upsert({
  branch_id: branchId,
  event_name: p.event,
  template_id: localRow.id,
  delay_minutes: 0,
  is_active: true,
}, { onConflict: 'branch_id,event_name' });
qc.invalidateQueries({ queryKey: ['whatsapp-triggers'] });
```

Requires a unique index on `(branch_id, event_name)` in `whatsapp_triggers` if not already present — add via migration if missing.

`WhatsAppAutomations.tsx`: import the canonical event list so the "Add Automation" dropdown shows every supported event (birthday, retention, booking, etc.), not just 12.

### 4. Remove AI Agent sub-tab from Templates Hub

`CommunicationTemplatesHub.tsx`:
- Drop the `ai-agent` `TabsTrigger` and its `TabsContent` from the WhatsApp inner tab strip.
- Drop the `WhatsAppAISettings` import.
- Reduce the WhatsApp inner strip from 6 → 5 tabs: CRM Templates · Coverage & AI · Meta Approved · Automations · Number Routing.
- AI Agent settings remain accessible from their own existing settings entry (not removed from the app, only from this hub).

## Files

- **Create** `src/lib/templates/systemEvents.ts` — canonical catalog + helpers.
- **Edit** `src/components/settings/TemplateCoverageMatrix.tsx` — use catalog, per-channel filtering.
- **Edit** `src/components/settings/AIGenerateTemplatesDrawer.tsx` — use catalog; upsert `whatsapp_triggers` on save.
- **Edit** `src/components/settings/WhatsAppAutomations.tsx` — use catalog for event picker.
- **Edit** `src/components/settings/CommunicationTemplatesHub.tsx` — remove AI Agent sub-tab.
- **Migration** (only if missing): unique index `whatsapp_triggers (branch_id, event_name)`.

## Out of scope

- Building the actual server-side cron/event emitters for new events (e.g. `retention_nudge_t1`, `pos_order_completed`). Those already exist for some events; new emitters can be wired in a follow-up. The templates + automations rows will be ready and dormant until the emitter fires them.
