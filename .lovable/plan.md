# Templates Hub — Restore SMS + Email, Add AI Generation for All Channels

## Problem

The Settings → Templates tab was collapsed into a WhatsApp-only "WhatsApp Templates Hub" in the previous unification. SMS and Email template management is no longer reachable from the UI even though `TemplateManager` already supports them. WhatsApp settings (AI agent, automations, routing, health) are also scattered.

## Target structure

Rebuild Settings → Templates as a single, clean **Communication Templates Hub** with 4 top sub-tabs:

```text
Settings → Templates
├─ 🟢 WhatsApp        (templates + Meta sync + Health audit + Event mapping + AI generate)
│   └─ inner section "WhatsApp Settings": AI Agent, Automations, Routing  (collapsible cards)
├─ 🔵 SMS             (templates list + AI generate + DLT registration hint)
├─ 🟠 Email           (templates list + AI generate + subject + HTML/plain body)
└─ ✨ AI Studio       (one-screen generator: pick channel + events → preview → bulk save)
```

Each channel tab shares the same beautiful, Vuexy-style layout:

- Toolbar: search, filter (active/inactive), **AI Generate** (channel-aware), **+ New Template**.
- Health strip (only on WhatsApp & SMS): missing-events badges, click → prefill creator.
- Templates table with row actions: edit, duplicate, preview, delete, send-test.
- Right-side drawer (Sheet) for create/edit using existing `TemplateManager` editor body.

## Changes

### 1. Replace `WhatsAppTemplatesHub` with a channel-tabbed `CommunicationTemplatesHub`

New file: `src/components/settings/CommunicationTemplatesHub.tsx`

```tsx
<Tabs value={tab} onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
    <TabsTrigger value="sms">SMS</TabsTrigger>
    <TabsTrigger value="email">Email</TabsTrigger>
    <TabsTrigger value="ai">AI Studio</TabsTrigger>
  </TabsList>
  <TabsContent value="whatsapp"><WhatsAppChannelView /></TabsContent>
  <TabsContent value="sms"><ChannelTemplatesView channel="sms" /></TabsContent>
  <TabsContent value="email"><ChannelTemplatesView channel="email" /></TabsContent>
  <TabsContent value="ai"><AIStudioPanel /></TabsContent>
</Tabs>
```

Wire into `src/pages/Settings.tsx` (`templates: <CommunicationTemplatesHub />`).

### 2. WhatsApp tab keeps everything WhatsApp-related in one place

`WhatsAppChannelView` = current `WhatsAppTemplatesHub` content + a collapsible **"WhatsApp Settings"** section at the bottom containing:

- `WhatsAppAISettings` (AI agent on/off, prompts)
- `WhatsAppAutomations` (event → template map) — already there
- `WhatsAppRoutingSettings` (number routing, fallback)

All wrapped in shadcn `Collapsible`/`Accordion` for tidiness.

### 3. New shared `ChannelTemplatesView` for SMS & Email

File: `src/components/settings/ChannelTemplatesView.tsx`

- Lists templates from `templates` table filtered by `type`.
- Search + active filter, table with edit/dup/delete/preview, right-side `TemplateEditorSheet` re-using the existing form fields (re-extracted from `TemplateManager`).
- Email view shows `subject` column + WYSIWYG-lite textarea + variable picker + preview.
- SMS view shows char count + DLT template-id field (already exists in schema as `dlt_template_id` if present; otherwise add a free-text input persisted in `metadata` jsonb).
- Per-row "Send Test" → calls existing `dispatch-communication` with the operator's own number/email.

### 4. AI Generate for SMS + Email + WhatsApp (single edge fn)

Extend the existing `supabase/functions/ai-generate-whatsapp-templates` → rename **logically** by adding a `channel` field (keep the same fn name to preserve existing deployments; add an optional `channel: 'whatsapp' | 'sms' | 'email'` parameter, default `whatsapp`).

System prompt branches per channel:
- **WhatsApp**: existing rules.
- **SMS**: ≤ 160 chars per message, no emojis, no URLs (per Indian DLT), use named vars, return suggested DLT category (Promotional/Transactional/Service Implicit/Service Explicit).
- **Email**: produce `subject` + `body_html` (light HTML) + `body_text` fallback; subject ≤ 80 chars; suggest preheader.

Tool schema gains `channel`, optional `subject`, `body_html`. Frontend AI drawer is generalised → `AIGenerateTemplatesDrawer` accepts a `channel` prop and changes the candidate-event list / preview UI accordingly (shared 19 lifecycle events; for Email also includes "newsletter", "offer_pdf", etc.).

### 5. AI Studio tab — one place to bulk-author

`AIStudioPanel`:
- Step 1: pick channel (WhatsApp/SMS/Email), pick events (multi-select, defaults to "all events missing for this channel" pulled from a new `missing_templates_by_channel` query — reuses the WhatsApp Health logic generalised per channel).
- Step 2: AI generates proposals via the upgraded edge fn.
- Step 3: review & bulk-save (writes to `templates` table; for WhatsApp also submits to Meta via existing `manage-whatsapp-templates`).

### 6. Pre-broadcast guard — "always use AI to ensure template exists"

In `BroadcastDrawer` (the unified composer): when an external channel + non-empty content are selected and **no saved template** matches, show a soft inline banner:

> "No saved template for this WhatsApp message. AI can generate and save one for you in 5 seconds." → button opens `AIGenerateTemplatesDrawer` pre-filled with a "custom from this message" event.

This nudge keeps operators from blasting unapproved content but never blocks them.

## Files

| Action | File |
|---|---|
| new | `src/components/settings/CommunicationTemplatesHub.tsx` |
| new | `src/components/settings/ChannelTemplatesView.tsx` (SMS + Email shared) |
| new | `src/components/settings/TemplateEditorSheet.tsx` (extracted from TemplateManager form body) |
| new | `src/components/settings/AIStudioPanel.tsx` |
| edit | `src/components/settings/WhatsAppTemplatesHub.tsx` → keep, but render only the WhatsApp slice; reused inside the new hub |
| edit | `src/components/settings/AIGenerateTemplatesDrawer.tsx` → accept `channel` prop, adjust candidate events, render subject/HTML for email, char-count for SMS |
| edit | `src/pages/Settings.tsx` → `templates: <CommunicationTemplatesHub />` |
| edit | `src/components/announcements/BroadcastDrawer.tsx` → add "no template?" AI nudge when message > 0 and channel ∈ {whatsapp} |
| edit | `supabase/functions/ai-generate-whatsapp-templates/index.ts` → multi-channel prompts + tool schema |
| edit | `mem://index.md` Core: "Templates Hub at Settings → Templates: 4 sub-tabs (WhatsApp / SMS / Email / AI Studio). One AI edge fn (`ai-generate-whatsapp-templates`, channel-aware) generates proposals for all channels." |

## UX details

- Cards: `rounded-2xl shadow-lg shadow-slate-200/50`, gradient header strip per channel (emerald/blue/amber/violet).
- Channel header strip: count of active templates · count of missing critical events · last sync time (WhatsApp).
- Empty state per channel: Lucide icon + "Generate ready-to-use {channel} templates with AI" CTA.
- Variable chips reusable across all editors.
- Mobile: tabs stack as scrollable pill row.

## Acceptance

- Settings → Templates shows 4 sub-tabs with feature-parity for SMS/Email + WhatsApp.
- Operator can author or AI-generate templates for any channel from one place.
- WhatsApp settings (AI agent, automations, routing) are nested under the WhatsApp tab — no longer scattered.
- Broadcasting a WA message without a saved template surfaces the AI generator (no blocker).
