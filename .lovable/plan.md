# Communication Hub — Timeline polish + Marketing media campaigns

## Part 1 — Compact, colorful Delivery Timeline

File: `src/components/communications/DeliveryTimeline.tsx`

- Reduce overall width and density:
  - Wrap row in `max-w-md mx-auto` and tighten gaps; smaller stage circles (`h-7 w-7`), labels `text-[10px]`, timestamp `text-[9px]`.
  - Connector line becomes a multi-segment colored bar (each segment fills as the stage is reached) instead of a single grey line.
- "Live" colorization rules per stage (only when reached):
  - queued → amber, sent → sky, delivered → emerald, read → violet, replied → indigo, failed/bounced → rose.
  - Active (latest reached) stage gets a subtle pulse: `ring-2 ring-current/40 animate-pulse` for ~1.2s after status change.
  - Future/unreached stages: muted (`bg-muted text-muted-foreground/40`), no color.
- Add an "active stage" derivation: last entry in `events` (already streamed via realtime) → highlight its circle and its preceding connector segments in the stage color.
- Keep failure banner but compact (`py-1.5 text-[11px]`).

Result: the strip becomes ~⅓ narrower, and stages light up as the message progresses (Queued → Sent → Delivered turn amber → sky → emerald in real time).

## Part 2 — In-App attachment (flyer/poster) support

Currently `BroadcastDrawer` only attaches on WhatsApp/Email. In-App announcements have no media field.

### DB migration
Add columns to `public.announcements`:
```sql
alter table public.announcements
  add column if not exists attachment_url text,
  add column if not exists attachment_kind text check (attachment_kind in ('image','document','video')),
  add column if not exists attachment_filename text;
```

### UI
- `BroadcastDrawer.tsx`:
  - Change `showAttachment` to also include `inapp`: `selectedChannels.has('inapp') || …`.
  - On in-app insert, persist `attachment_url/kind/filename`.
  - Update helper text: "Image, PDF or short video — used on In-App, WhatsApp and Email."
  - Accept `image/*,application/pdf,video/mp4` (max 16MB).
- `AnnouncementCard` (in-app feed): if `attachment_url` exists, render:
  - image → thumbnail (click → lightbox),
  - pdf/document → download chip with filename,
  - video → inline `<video controls>` (mp4 only).

## Part 3 — Marketing media campaigns (events / classes / promos / supplements)

Goal: send rich flyers/posters/videos via Email + WhatsApp + In-App from one composer, with reusable Meta-approved media templates.

### A. Reusable "Marketing Media" WhatsApp templates (Meta)
The `manage-whatsapp-templates` edge fn already supports `header_type` (image/video/document) + `header_sample_url`. We will expose this in the Templates Hub:

- `MetaTemplatesPanel.tsx` → "Create Meta Template" drawer:
  - Add **Category selector** (UTILITY / MARKETING / AUTHENTICATION) — required by Meta.
  - Add **Header Media** picker (None / Image / Video / Document) → uploads sample file via `uploadAttachment` to a public bucket and passes `header_sample_url`.
  - Add **Event Type tag** (`class | event | promo | deal | supplement | generic`) stored in `templates.metadata.event_type` for filtering.
- Seed 4 starter templates (drafts only, owner submits to Meta):
  - `marketing_class_announcement` (image header)
  - `marketing_event_invite` (image header)
  - `marketing_promo_offer` (image header)
  - `marketing_supplement_launch` (image or video header)
  - Bodies use `{{1}}` member name + `{{2}}` headline + `{{3}}` CTA; CTA URL button with `{{1}}`.

### B. Campaign Wizard — media + multi-channel

`src/components/campaigns/CampaignWizard.tsx`:
- Channel step: replace single-select with **multi-select chips** (WhatsApp / Email / In-App). SMS hidden when media attached (carrier limits).
- New "Creative" step:
  - Upload flyer (image), poster (image), or short video (mp4 ≤16MB), or PDF.
  - Optional headline + CTA URL.
  - For WhatsApp: dropdown of Meta-approved **Marketing Media** templates filtered by `metadata.event_type`. The uploaded media replaces the template's header at send-time (Meta supports per-message header media URL).
- Audience + Schedule steps unchanged.
- On submit, the wizard creates one campaign per channel (existing pattern) and includes `attachment_url/kind/filename` so `send-broadcast` → `dispatch-communication` already routes media correctly.

### C. Edge function plumbing
- `send-broadcast` already forwards `attachment_*` to `dispatch-communication` (v3.2.0). For WhatsApp marketing-media template path, ensure the dispatch builds the Meta payload's `header.parameters[0]` with the chosen media URL when the template has a media header — small patch in `dispatch-communication`'s WhatsApp template builder (look up `templates.metadata.header_type` and inject `image`/`video`/`document` link param).
- For In-App, broadcast writes a row to `announcements` (Part 2) with the attachment.
- For Email, the existing attachment passthrough already embeds the file.

### D. Campaign manager UI
`CampaignsPanel`: add a "Marketing & Events" filter chip; surface campaigns whose channels include media; show thumbnail of attachment in row.

## Files touched

- `src/components/communications/DeliveryTimeline.tsx` (compact + colorize)
- `src/components/announcements/BroadcastDrawer.tsx` (in-app attachment, wider accept list)
- `src/components/announcements/AnnouncementCard.tsx` (render media)
- `src/components/settings/MetaTemplatesPanel.tsx` (category + media header + event_type)
- `src/components/campaigns/CampaignWizard.tsx` (multi-channel + creative step + media template picker)
- `src/components/campaigns/CampaignsPanel.tsx` (thumbnail + filter)
- `supabase/functions/dispatch-communication/index.ts` (inject media header param for templates with header_type)
- Migration: `announcements` attachment columns + 4 seed marketing template drafts in `templates`.

## Out of scope
- SMS media (carrier-restricted; only text links).
- Auto-translation of marketing copy.
