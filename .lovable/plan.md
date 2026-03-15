

# Smart Retention Engine: Multi-Channel Nudge Automation & Staff Escalation Dashboard

## What We're Building

A fully automated 3-tier retention sequence that sends escalating messages (WhatsApp, SMS, email) to absent members, resets on gym visit, and escalates to staff at Day 21. The admin gets a multi-channel campaign manager, and staff get a refined follow-up dashboard showing only post-automation escalations.

---

## 1. Database Changes

**Add `channel` column to `retention_templates`** — currently templates have no channel preference. Add a `channels` text array column (default `{'whatsapp'}`) so admins can pick which channels each stage fires on.

**Migration SQL:**
```sql
ALTER TABLE retention_templates 
  ADD COLUMN IF NOT EXISTS channels text[] DEFAULT '{whatsapp}';

-- Add spam-prevention constraint column
ALTER TABLE retention_nudge_logs
  ADD COLUMN IF NOT EXISTS message_content text;
```

No new tables needed — `retention_templates` and `retention_nudge_logs` already exist with the right structure.

## 2. Edge Function: `run-retention-nudges`

**New Edge Function** triggered daily via pg_cron. Logic:

1. For each active branch, call `get_inactive_members(branch, 5, 200)` to get all members absent 5+ days.
2. For each member, calculate `days_absent` and determine which stage to trigger (Day 5 → Stage 1, Day 10 → Stage 2, Day 15 → Stage 3).
3. **Spam guard**: Check `retention_nudge_logs` — skip if this member already received this `stage_level` within 30 days.
4. **Reset guard**: If member has a `member_attendance` record after their last nudge, skip (they came back).
5. For each channel in the template's `channels` array:
   - **WhatsApp**: Call `send-whatsapp` edge function internally
   - **SMS/Email**: Log to `communication_logs` (actual delivery depends on integration config)
6. Insert into `retention_nudge_logs` with `template_id`, `stage_level`, `channel`, `message_content`.

**Config.toml**: Add `[functions.run-retention-nudges]` with `verify_jwt = false`.

**pg_cron**: Schedule daily at 9 AM UTC.

## 3. Admin UI: Enhanced Retention Campaign Manager

**Edit `src/components/settings/RetentionCampaignManager.tsx`**:

- Add **multi-channel selector** (checkboxes: WhatsApp, SMS, Email) per stage
- Add **preview panel** showing the personalized message with `{member_name}` replaced
- Add **"Test Send"** dropdown with channel options (WhatsApp opens wa.me, SMS opens sms:, Email opens mailto:)
- Add **delivery stats** per stage (count from `retention_nudge_logs` grouped by `stage_level`)
- Add **30-day cooldown indicator** showing when the next cycle can fire

## 4. Staff Dashboard: Day 21 Escalation View

**Edit `src/pages/StaffDashboard.tsx`**:

- Refactor "Inactive Members (7+ days)" card to show **two sections**:
  - **"In Sequence"** (7-20 days absent) — compact list with nudge progress badge (e.g., "2/3 nudges sent")
  - **"Requires Follow-Up"** (21+ days, all 3 nudges sent) — highlighted with full context

- For Day 21+ members, display:
  - Fitness Goal (from `members.fitness_goals`)
  - Last visit date
  - Badge: "Automated Nudges: 3/3"
  - Quick-action buttons: `[Left Voicemail]`, `[Offered Freeze]`, `[Coming Back Tomorrow]` — each inserts into `retention_nudge_logs` with `resolution`

**Edit `src/components/retention/SmartAssistDrawer.tsx`**:

- Add **channel selector** (WhatsApp / SMS / Email radio) for manual messages
- SMS action: opens `sms:` URL with message body
- Email action: opens `mailto:` URL with subject + body
- Show member's `fitness_goals` in the context header
- Display last attendance date from `member_attendance`

## 5. Follow-Up Center Enhancement

**Edit `src/pages/FollowUpCenter.tsx`**:

- In the "Inactive" tab, filter to show only members with `days_absent >= 21`
- Add nudge history badges (query `retention_nudge_logs` count per member)
- Add quick resolution buttons matching the SmartAssistDrawer pattern

## 6. Send-Reminders Integration

**Edit `supabase/functions/send-reminders/index.ts`**:

- In section 7 (inactive member alerts), **remove** the generic "We miss you" notification for members
- Instead, add a check: if member has `days_absent >= 21` AND has 3 nudge logs, create a **staff task** notification only
- This prevents the send-reminders function from conflicting with the dedicated retention engine

---

## Files Summary

| File | Action |
|------|--------|
| DB Migration | Add `channels` column to `retention_templates`, `message_content` to `retention_nudge_logs` |
| `supabase/functions/run-retention-nudges/index.ts` | **New** — Daily CRON edge function for 3-tier nudge automation |
| `supabase/config.toml` | Add `run-retention-nudges` entry |
| `src/components/settings/RetentionCampaignManager.tsx` | Add multi-channel selectors, delivery stats, preview |
| `src/components/retention/SmartAssistDrawer.tsx` | Add channel selector (WhatsApp/SMS/Email), fitness goals, last visit |
| `src/pages/StaffDashboard.tsx` | Split inactive list into "In Sequence" vs "Day 21+ Escalation" |
| `src/pages/FollowUpCenter.tsx` | Filter inactive tab to Day 21+, add nudge badges and resolution buttons |
| `supabase/functions/send-reminders/index.ts` | Remove generic member retention messages, defer to nudge engine |

## Execution Order

1. Database migration (add columns)
2. Create `run-retention-nudges` edge function + config.toml + pg_cron
3. Update RetentionCampaignManager with multi-channel UI
4. Update SmartAssistDrawer with channel selector + member context
5. Refactor StaffDashboard inactive section
6. Update FollowUpCenter inactive tab
7. Clean up send-reminders to avoid conflicts

