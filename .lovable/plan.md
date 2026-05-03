## Goals

1. Re-sync local CRM with Meta after you deleted templates there.
2. Collapse the 4 sub-tabs (CRM / Meta Approved / Event Mapping / Health) under Settings → Templates Manager into a **single WhatsApp tab** with everything in one scrollable surface.
3. Add **AI generator** that audits the codebase's outbound events and proposes/creates clean Meta-compliant templates (no duplicates, no junk).
4. Add **bulk operations**: bulk submit/resubmit to Meta, bulk delete locally, bulk reset.
5. Make broadcasts + campaigns support **PDF/image attachments** properly (UI + send path).

---

## 1. Unified WhatsApp Templates tab

Refactor `src/components/settings/WhatsAppTemplatesHub.tsx`:

- Remove the 4-tab `Tabs` shell. Render one stacked layout:
  ```
  ┌── Toolbar ──────────────────────────────────────────────┐
  │ [Sync from Meta] [AI Generate] [Bulk Submit] [Audit]    │
  └─────────────────────────────────────────────────────────┘
  ┌── Health summary strip (compact, from WhatsAppTemplatesHealth) ─┐
  ┌── Templates table (CRM + Meta status merged) ───────────────────┐
  │ name │ channel │ category │ Meta status │ event mapping │ ⋯    │
  ┌── Side drawer: edit / create / AI generate ─────────────────────┐
  ```
- Keep `TemplateManager`, `MetaTemplatesPanel`, `WhatsAppTemplatesHealth`, `WhatsAppAutomations` as internal pieces but mount them inline (no tabs). Health becomes a top alert card listing events without a working template, with inline "Generate with AI" CTA.
- Settings sidebar entry "Templates Manager" stays; just the inner tabs disappear.

## 2. AI template generator

New edge function `ai-generate-whatsapp-templates` (uses Lovable AI Gateway, model `google/gemini-2.5-pro`):

- Input: `{ branch_id, events: string[], mode: 'audit'|'single', existing: [{name, body}] }`.
- System prompt seeds it with: Meta UTILITY/MARKETING rules, our variable conventions (`{{member_name}}`, `{{branch_name}}`, etc.), tone (Incline brand), max 1024 chars, no emojis in body, must be deduplicated against `existing`.
- Tool-calling output (structured): array of `{ event, name, category, language, body_text, variables[], header_type?, sample_header_url? }`.
- Edge fn does NOT submit to Meta — returns proposals. Frontend shows a review drawer where user can Accept / Edit / Submit.

New UI in the unified tab: **"AI Generate"** button → opens a Sheet:
- Lists every event from `EVENT_PREFILLS` + scanned `whatsapp_triggers` + missing-from-health.
- User selects events → calls edge fn → preview cards → "Approve & Submit to Meta" runs `manage-whatsapp-templates` action `create` for each.

## 3. Bulk operations

Extend `manage-whatsapp-templates`:
- New action `bulk_create`: array of `template_data`, returns per-row result.
- New action `bulk_delete_local`: delete rows from `templates` + `whatsapp_templates` by ids (does not touch Meta — note already in UI).
- Existing `list` already upserts; keep.

UI:
- Toolbar "Bulk Submit Pending" → submits every CRM template that has no `meta_template_name`.
- "Reset & Re-Audit" → wipes local rows, then runs AI audit to regenerate the canonical set, then bulk-submits.

## 4. Broadcasts + campaigns: PDF / image attachments

`dispatch-communication` already accepts an `attachment` object (URL + kind + filename). The send-broadcast path doesn't.

Changes:
- `supabase/functions/send-broadcast/index.ts`: accept `attachment_url`, `attachment_kind` (`image|document`), `attachment_filename`; forward into `dispatch-communication` payload.
- `BroadcastDrawer.tsx`: add an "Attachment" section (file input → uploads to existing `whatsapp-attachments` bucket via `uploadAttachment` util, or paste URL). For WhatsApp + Email channels only. Show inline preview thumbnail.
- Campaigns (`campaignService` / campaigns tab): same attachment field on campaign create. Persist `attachment_url/kind/filename` on the campaign row, then `send-broadcast` reads them when the scheduled job fires.
- For Meta WhatsApp **template** sends with media header, `manage-whatsapp-templates` `create` already accepts `header_type` + `header_sample_url` — wire the AI generator and the manual editor to set these so image/PDF templates can be approved + reused.

## 5. Re-sync flow after Meta deletion

Once code is in:
1. Click **Sync from Meta** → empties `whatsapp_templates` for stale rows (add a soft "stale" flag for any local row not returned in last sync), shows you the truly-empty Meta catalog.
2. Click **Reset & Re-Audit** → AI proposes clean canonical set → review → bulk-submit to Meta → poll status.

## Files touched

```
src/components/settings/WhatsAppTemplatesHub.tsx        rewrite (single tab)
src/components/settings/TemplateManager.tsx             keep, embed
src/components/settings/MetaTemplatesPanel.tsx          embed inline
src/components/settings/WhatsAppTemplatesHealth.tsx     embed as alert strip
src/components/settings/AIGenerateTemplatesDrawer.tsx   NEW
src/components/announcements/BroadcastDrawer.tsx       + attachment field
src/services/campaignService.ts                         + attachment fields
supabase/functions/manage-whatsapp-templates/index.ts  + bulk_create, bulk_delete_local, mark_stale
supabase/functions/ai-generate-whatsapp-templates/     NEW (Lovable AI)
supabase/functions/send-broadcast/index.ts             + attachment passthrough
supabase/migrations/…                                   campaigns: attachment_url/kind/filename; whatsapp_templates: is_stale bool
```

## Notes / tradeoffs

- We do not auto-delete from Meta (their API requires manual or `name` delete and you've already done it). The audit/reset only touches our DB and re-submits.
- AI runs only on demand; no background cost.
- Attachment uploads use the existing storage bucket — no new bucket needed.
