# Communication Hub — Revised Cleanup Plan

## New direction (per your guidance)

- **Delete the "New Announcement" button + drawer.** It's redundant.
- **Keep the Broadcast drawer** and upgrade it to be the single composer for all 4 channels: **In-App, WhatsApp, SMS, Email** + a **Schedule** option.
- **Marketing & Campaigns** stays as the promotional engine — events, offers, images/PDFs, segments of members + leads + contacts.

```text
Communication Hub
├─ Live Feed         → unchanged
├─ Broadcast (button) → composer with channels [In-App, WhatsApp, SMS, Email] + Send now / Schedule
├─ Announcements tab  → history/list of in-app messages (read-only feed; member portal source)
├─ Campaigns tab      → marketing & promotional campaigns (images, offers, segments, recurring)
└─ Retry Queue
```

## Changes

### 1. Broadcast drawer becomes the unified composer

File: `src/components/announcements/BroadcastDrawer.tsx`

Add to the existing drawer:

- **In-App channel** as a 4th checkbox (icon `Bell`, color violet). Must be selectable alongside SMS/WhatsApp/Email.
- **Title field** (required when In-App is checked) — maps to `announcements.title`.
- **Schedule section**: radio `Send now | Schedule for later`. When Schedule chosen, show a Shadcn date+time picker (datetime-local). Stored value goes to `publish_at` (in-app) and/or `scheduled_at` (campaign).
- **Audience options** unchanged for now (`all / active / expiring / expired`) — those that make sense for in-app target via `target_audience`.
- **Submit logic**:
  1. If In-App is selected → `INSERT into announcements` with `title`, `content=message`, `target_audience`, `publish_at`, `is_active=true`. (If scheduled in future, members start seeing it after `publish_at`; we already filter on the member portal.)
  2. For each external channel selected (whatsapp/sms/email) → call `send-broadcast` (immediate) OR `createCampaign(... scheduled_at, status='scheduled')` (when Schedule chosen). Existing `process-scheduled-campaigns` cron handles dispatch.
  3. Attachments (image/PDF) continue to flow to whatsapp/email; ignored for sms/in-app.

Rename header button: **"Broadcast" → "New Announcement"** (single CTA on the page).

### 2. Delete the redundant Announcement creation surface

| Action | File |
|---|---|
| delete | `src/components/announcements/AddAnnouncementDrawer.tsx` |
| edit   | `src/pages/Announcements.tsx` — remove `AddAnnouncementDrawer` import + `New Announcement` button + `showAddDrawer` state. Keep the **Announcements tab** but make it a read-only list of past in-app messages from `announcements` table (history view). |

### 3. Member portal in-app delivery

`src/pages/MemberAnnouncements.tsx` already reads from `announcements` table filtered by branch and active. Add `publish_at <= now()` filter so scheduled in-app messages only appear at their time. (Optional small follow-up: add `expire_at` check.)

### 4. Marketing & Campaigns — stays, with clarity

- Add a clearer subtitle on `CampaignsPanel`: *"Promotional campaigns — events, offers, images/PDFs to members, leads and contacts. Use **New Announcement** in the header for quick one-shot sends."*
- Surface attachment picker prominently in `CampaignWizard` step 2 (already wired in `send-broadcast` / `campaigns` schema).
- Keep the wizard / segments / scheduling behavior as-is. No deletions.

### 5. Edge & DB

- No schema migration needed — `announcements` already has `publish_at`, `expire_at`, `target_audience`. `campaigns` already has `scheduled_at`, attachments, segments.
- `process-scheduled-campaigns` cron is already running for scheduled outbound.
- Keep `supabase/functions/send-broadcast` (immediate path).

### 6. Files touched

- delete `src/components/announcements/AddAnnouncementDrawer.tsx`
- edit `src/components/announcements/BroadcastDrawer.tsx` (in-app channel, title, schedule, dispatch logic)
- edit `src/pages/Announcements.tsx` (remove Add button/state, rename Broadcast → New Announcement, tab becomes history)
- edit `src/pages/MemberAnnouncements.tsx` (filter by `publish_at <= now()`)
- edit `src/components/campaigns/CampaignsPanel.tsx` (clarify subtitle)

### 7. Memory

Update `mem://index.md` Core: *"Communication Hub — single composer (`BroadcastDrawer`) handles In-App + WhatsApp + SMS + Email with optional Schedule. Marketing & Campaigns is for promotional/recurring sends with attachments + segments."*

## Acceptance

- One CTA on /announcements: **New Announcement** opens the unified composer.
- Operator can pick any combination of In-App / WA / SMS / Email, attach a file (WA+Email), choose Send now or Schedule, and one click delivers everything.
- Announcements tab shows the in-app history.
- Marketing & Campaigns remains for promo workflows.
