## Goal
Consolidate Marketing & Campaigns under the existing **Communication Hub** (Announcements page), add **scheduled campaigns**, complete the **WhatsApp human-handoff workflow** (with staff routing aligned to Meta's Cloud API constraints), and **seed a real test campaign** sent to member **Ryan Lekhari** using a Meta-approved template.

---

## 1. Move "Marketing & Campaigns" into the Communication Hub

The standalone `/campaigns` page becomes a tab inside `Announcements.tsx` (which already hosts Live Feed, Announcements, Retry Queue) — single source of truth for all outbound comms.

- Add a new **"Campaigns"** tab to `src/pages/Announcements.tsx` between "Announcements" and "Retry Queue".
- Tab body renders the existing campaign list UI (extracted from `Campaigns.tsx` into a reusable `<CampaignsPanel />` component) plus the **"+ New Campaign"** CTA that opens `CampaignWizard`.
- Update `src/config/menu.ts`: remove the standalone "Marketing & Campaigns" entries (lines 201, 276). The Communication Hub menu item stays and now covers campaigns.
- Keep the `/campaigns` route working but redirect to `/announcements?tab=campaigns` so old links don't 404.
- Read `?tab=` query param in Announcements to allow deep-linking.

## 2. Campaign Scheduling

Database + UI + worker for scheduled sends.

**Schema (migration):**
- `campaigns.scheduled_at` already exists — wire it up.
- Add `campaigns.timezone text default 'Asia/Kolkata'` and `campaigns.last_run_error text`.
- Allow `trigger_type = 'scheduled'` (already in CHECK constraint).

**Wizard (Step 3 — Trigger):**
- Add a third option **"Schedule for Later"** alongside "Send Now" and "Save as Automated Rule".
- When selected, show a date+time picker (shadcn `Calendar` + time input). Persists to `scheduled_at` with `status='scheduled'`.

**Cron worker (new edge function `process-scheduled-campaigns`):**
- Runs every minute via `pg_cron` + `pg_net`.
- Picks campaigns where `status='scheduled' AND scheduled_at <= now()`, marks them `sending`, resolves audience server-side (port `resolveAudienceMemberIds` logic into Deno), and invokes `send-broadcast`.
- Updates `success_count`, `failure_count`, `sent_at`, `status='sent'` (or `'failed'` with `last_run_error`).

**UI badges:** Campaign cards show countdown ("Sends in 2h 14m") for scheduled items.

## 3. WhatsApp Human Handoff Workflow

Currently `set_handoff` RPC pauses the bot and creates broadcast notifications, but staff can't be **assigned** an incoming WhatsApp chat. We'll complete the loop within Meta Cloud API limits.

**Meta constraint reminder** *(per project memory `whatsapp-meta-cloud-api`)*: Meta Cloud API does **not** support transferring a conversation to another WhatsApp number. The conversation stays on the business number; "handoff" means **assigning a staff user inside our app** who will reply through the same shared inbox. Optional: notify that staffer on **their personal WhatsApp** with a deep link back to the in-app chat.

**Schema additions:**
- Reuse existing `whatsapp_chat_settings.assigned_to` (uuid → auth.users).
- Add `whatsapp_chat_settings.handoff_reason text` and `handoff_requested_at timestamptz`.
- New table `staff_whatsapp_routing` (branch_id, user_id, personal_phone, is_available bool, role_filter text[]) — lets managers register their own WhatsApp number for handoff alerts.

**RPC `set_handoff` (extend existing):**
- Accept optional `_assigned_to uuid`. If null, auto-pick the next available staff in `staff_whatsapp_routing` for that branch (round-robin on `last_assigned_at`).
- Set `assigned_to`, `handoff_reason`, `handoff_requested_at`, `bot_active=false`.
- Insert in-app notification AND fire `notify-staff-handoff` edge function.

**New edge function `notify-staff-handoff`:**
- Sends a WhatsApp template message ("handoff_alert_v1") to the staff's personal phone using the same Meta number, with deep-link button → `https://app/whatsapp-chat?phone=<member_phone>`.
- Falls back to email + in-app notification if the staff hasn't registered a personal phone.

**UI updates in `WhatsAppChat.tsx`:**
- Header shows handoff banner with **"Assigned to: <staff name>"** and a **"Reassign"** dropdown listing available staff.
- "Resume Bot" button clears `assigned_to` and sets `bot_active=true`.
- New Settings tab **"WhatsApp Routing"** (under existing WhatsApp settings) for managers to register their personal phone & toggle availability.

## 4. Seed Marketing & Campaigns + Test with Ryan

**Seed templates** (insert via insert tool, not migration — these are data):
- `welcome_offer_v1` (utility): "Hi {{1}}, welcome to {{2}}! Enjoy 10% off PT sessions this month."
- `reengagement_v1` (marketing): "Hi {{1}}, we miss you at {{2}}. Come back this week for a free recovery session."
- `event_invite_v1` (marketing): "Hi {{1}}, join us at {{2}} on {{3}} for community day."

For each, call `manage-whatsapp-templates` edge function which submits to Meta's Graph API for approval (existing function — verify it handles the create flow). Status will move from `PENDING` → `APPROVED` automatically via Meta webhook (already wired in `whatsapp-webhook`).

**Seed campaigns** (one per channel):
- "Welcome Push — Active Members" (WhatsApp, sent_now)
- "April Re-engagement" (WhatsApp, scheduled +1 day)
- "May Newsletter" (Email, draft)

**Live test with Ryan** *(member id `5cfda8f1-…`, phone `9928910901`, branch INCLINE)*:
- Create campaign **"Test — Ryan"** with audience explicitly resolved to Ryan's id only (use a `member_ids` override in the wizard's preview step → debug-only "Send to specific member" field, hidden behind owner role).
- Trigger send_now via `send-broadcast` once `welcome_offer_v1` is APPROVED by Meta.
- Verify delivery in `campaign_runs` (status=`sent`), in `whatsapp_messages` log, and visually in WhatsApp Chat tab.

---

## Technical Section

**Files to create**
- `src/components/campaigns/CampaignsPanel.tsx` — extracted list + CTA.
- `src/components/campaigns/ScheduleStep.tsx` — date/time picker block for wizard step 3.
- `src/components/settings/WhatsAppRoutingSettings.tsx` — staff routing registration UI.
- `supabase/functions/process-scheduled-campaigns/index.ts` — cron worker.
- `supabase/functions/notify-staff-handoff/index.ts` — staff alert sender.

**Files to edit**
- `src/pages/Announcements.tsx` — add Campaigns tab, read `?tab=` param.
- `src/pages/Campaigns.tsx` — convert to redirect (`<Navigate to="/announcements?tab=campaigns" />`).
- `src/components/campaigns/CampaignWizard.tsx` — add Schedule trigger option, owner-only "specific member" debug field.
- `src/services/campaignService.ts` — add `scheduled_at`, `timezone` to create/update; add `sendToSpecificMembers` helper.
- `src/pages/WhatsAppChat.tsx` — handoff banner, reassign dropdown, resume bot.
- `src/config/menu.ts` — remove duplicate "Marketing & Campaigns" entries.
- `supabase/functions/send-broadcast/index.ts` — accept `template_name` + `template_params` for Meta-approved sends.

**Migrations**
1. Add `timezone`, `last_run_error`, `handoff_reason`, `handoff_requested_at` columns.
2. Create `staff_whatsapp_routing` table + RLS (owner/admin/manager manage own row; staff can read same branch).
3. Replace `set_handoff` RPC with extended version (assignment + auto-routing).
4. Schedule `process-scheduled-campaigns` cron (every 1 min) — via insert tool, not migration (contains anon key).

**Data seeds** (insert tool)
- 3 WhatsApp template rows.
- 3 sample campaigns scoped to INCLINE branch.
- 1 routing row for the current owner so handoff has a valid target.

**Verification**
- Submit `welcome_offer_v1` to Meta → poll until APPROVED.
- Run "Test — Ryan" campaign → confirm row in `campaign_runs.status='sent'` and message visible in WhatsApp Chat thread for `9928910901`.
- Trigger handoff manually from chat → confirm `whatsapp_chat_settings.assigned_to` populated and staff WhatsApp alert delivered.

---

**Approve to proceed.** I'll execute migrations → deploy edge functions → seed data → submit templates to Meta → run the live Ryan test → report back with `campaign_runs` row + screenshot of delivered message.