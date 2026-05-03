# Communication Templates Hub — Fixes & Consolidation

## 1. Why the buttons are disabled (root cause)

`MetaTemplatesPanel` loads `integration_settings` filtered by the currently selected branch:

```
if (selectedBranch !== 'all') query = query.eq('branch_id', selectedBranch);
```

But the project's WhatsApp integration is stored as a **global row** with `branch_id = NULL` (verified in DB: 1 active global WhatsApp integration). When the user picks the **INCLINE** branch, that global row is excluded → `hasWhatsAppConfig = false` → the warning "Configure a WhatsApp integration in Settings → Integrations…" appears and **Test Connection / Sync from Meta are disabled**.

Same flaw exists in `WhatsAppTemplatesHealth` and `AIGenerateTemplatesDrawer` for the Meta-submit path.

### Fix
Change the integration query to include both branch-scoped and global rows:

```
.or(`branch_id.eq.${selectedBranch},branch_id.is.null`)
```

And invoke edge functions with `branch_id = selectedBranch (or null fallback)` so `manage-whatsapp-templates` resolves the right credentials. Also remove the "Select a specific branch first" toast when a global integration exists.

## 2. True two-way realtime sync with `templates` table

Currently "Sync from Meta" only puts results into local React state — it never writes back to the `templates` table, so the CRM Templates tab and Health audit don't reflect Meta status.

### Edge function `manage-whatsapp-templates` (action `sync`)
- Accept `action: 'sync'` that lists from Meta and **upserts** into `public.templates` keyed by `(meta_template_name, type='whatsapp')`:
  - On insert: name, language, category, body content reconstructed from Meta components, `meta_template_status`, `meta_rejection_reason`, `meta_template_name`, `is_active=true`.
  - On update: refresh status, rejection reason, language, category, body if changed.
- Returns `{ inserted, updated, total }`.

### Submit path (already partly there)
Keep the existing "Submit to Meta" in `TemplateManager` and ensure on success it writes `meta_template_name` + `meta_template_status='PENDING'` so the row appears in both panels immediately.

### Realtime
Add `templates` to `supabase_realtime` publication (migration). Both panels subscribe via:

```
supabase.channel('templates-meta')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'templates' }, …)
  .subscribe()
```

So Meta status changes (sync, webhook, or manual) reflect instantly across CRM Templates / Meta Approved / Templates Health.

## 3. Move "AI Agent" out of the Templates Hub

The AI Agent (chat behavior, model, system prompt, handoff) is **not a template concern**. Per request, it lives nested under WhatsApp but as **its own dedicated tab inside the WhatsApp section**, which it already does — keep it where it is. No change needed beyond grouping label.

(If user later wants it removed entirely from Templates Hub and surfaced under a separate WhatsApp Operations card, we can split — flagged but out of scope unless confirmed.)

## 4. Merge "Templates Health" + "AI Generate" into one workflow

Today both partially solve the same problem:
- **Templates Health** = audits which event triggers (`event_template_mappings` / `eventRegistry`) have a saved template; shows red/green per event with a "Fix" button.
- **AI Generate** = drawer that lets AI propose templates for chosen events.

### Consolidation
Replace both with a single sub-tab called **"Coverage & AI Studio"** (icon: `HeartPulse + Sparkles`):

```text
┌────────────────────────────────────────────────────────┐
│ Coverage  ●●●●●○○  73%   [ Auto-fill missing with AI ] │
├────────────────────────────────────────────────────────┤
│ ✓ member_created          → Welcome (en) [Edit][Submit]│
│ ✗ payment_received        →  — Missing —     [AI Draft]│
│ ⚠ membership_expiring_7d  → Draft (not approved) [Fix] │
│ …                                                      │
└────────────────────────────────────────────────────────┘
```

Behavior:
- Lists every event from `eventRegistry` for the current channel (WhatsApp/SMS/Email).
- Per-row status: Missing / Draft / Pending Meta / Approved / Rejected.
- **Per-row "AI Draft"** opens the AI drawer pre-scoped to that single event.
- **Header "Auto-fill missing with AI"** runs the bulk generator only for missing events (no duplicate proposals).
- After generation: save → `templates` row created → if WhatsApp + integration present, auto-submit to Meta.
- Realtime subscription keeps coverage % live.

The standalone "AI Generate" hero button stays as a quick entry point but routes to the same drawer. The separate "Templates Health" sub-tab is removed; coverage view replaces it.

## 5. Tabs after change

Top-level (Settings → Templates):
- WhatsApp · SMS · Email · AI Studio (channel-agnostic generator)

WhatsApp sub-tabs:
- CRM Templates · Coverage & AI · Meta Approved · Automations · AI Agent · Number Routing

SMS / Email sub-tabs (new, mirror structure):
- Templates · Coverage & AI

## 6. Files to change

- `src/components/settings/MetaTemplatesPanel.tsx` — integration `.or()` filter; allow global integration; realtime subscription on `templates`; clearer status banner.
- `src/components/settings/WhatsAppTemplatesHealth.tsx` — repurpose into reusable `<TemplateCoverageMatrix channel="whatsapp|sms|email" />`; integrate AI draft per row + bulk fill.
- `src/components/settings/AIGenerateTemplatesDrawer.tsx` — accept `prefilledEvents?: string[]` to seed selection from coverage view; on save, dispatch `manage-whatsapp-templates` submit when WhatsApp.
- `src/components/settings/CommunicationTemplatesHub.tsx` — drop "Templates Health" sub-tab; replace with "Coverage & AI"; add same coverage tab for SMS/Email.
- `supabase/functions/manage-whatsapp-templates/index.ts` — add `sync` action that upserts into `public.templates`; fall back to global `branch_id IS NULL` integration when branch row missing.
- New migration:
  - `ALTER PUBLICATION supabase_realtime ADD TABLE public.templates;`
  - Optional unique index `(type, meta_template_name) WHERE meta_template_name IS NOT NULL` to make upsert deterministic.

## 7. Out of scope (call out if needed)

- Webhook receiver for Meta template status updates (push from Meta → DB) — recommended next step but not part of this fix.
- Migrating existing global WhatsApp integration to per-branch rows.
