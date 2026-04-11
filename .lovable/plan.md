

# WhatsApp Templates Audit, Unread Badge Fix, Attachments, Lead Retention & Staff Handoff

## Findings

### 1. Template Rejection Root Cause: INVALID_FORMAT
Meta requires **numbered placeholders** (`{{1}}`, `{{2}}`) — NOT named ones (`{{member_name}}`). All 3 rejected templates used `{{member_name}}`, `{{member_code}}`, `{{end_date}}`, etc. The edge function `manage-whatsapp-templates` sends `body_text` directly with these named vars. Meta rejects them instantly.

**Fix:** Delete all existing templates. Re-create them with proper Meta-compatible format using `{{1}}`, `{{2}}`, `{{3}}` numbered params. Also update the edge function template create to auto-convert named vars to numbered ones before submission.

### 2. Sidebar Unread Badge — Actually Working Correctly
The DB shows 1 record with `is_unread: true` (`+919887601200`). The badge is correct. However, the **auto-read mutation** may not be triggering properly when you select this chat, OR this is a stale phone number variant (`+919887601200` vs `919887601200`). Need to normalize phone number matching in the auto-read logic and ensure it fires.

### 3. Attachment/Document Sending
The `send-whatsapp` edge function handles `image` type but **NOT `document`** type. When a PDF/DOCX is uploaded, the frontend sets `message_type: 'document'` but the edge function falls through to `text` type (the else branch). Need to add a `document` payload branch in the edge function.

### 4. Lead Retention (AI Follow-up After Silence)
Need a configurable "Lead Nurture Timer" — if a lead doesn't reply within X hours (configurable), the AI sends a gentle follow-up. This requires:
- A new `lead_followup_rules` config in `organization_settings`
- A scheduled edge function (or cron) that checks for stale conversations and sends follow-ups
- Configurable delay (e.g., 2h, 6h, 12h) and max retries (e.g., 2 attempts within 24h)

### 5. Staff Chat Handoff — Currently Working But Limited
Transfer to Staff **does work** — it updates `assigned_to` and sets `bot_active: false`. However:
- No notification is sent to the assigned staff member
- No filtering by "My Chats" for the assigned staff
- Staff can't see which chats are assigned to them specifically

### 6. Professional Meta-Compatible Templates for Incline Fitness
Will create ~15 WhatsApp templates using UTILITY and MARKETING categories with proper `{{1}}` numbered placeholders.

---

## Implementation Plan

### Epic 1: Delete All Templates & Re-create Meta-Compatible Ones
**Migration SQL:**
- DELETE all rows from `templates` table
- INSERT professional templates with proper `{{1}}`, `{{2}}` numbered placeholders
- Templates categorized: UTILITY (payment, booking, freeze/unfreeze, welcome) and MARKETING (birthday, referral, renewal, missed workout)

**Template Examples:**
```
Welcome (UTILITY):
"Welcome to Incline Fitness, {{1}}! 🏋️ Your membership ({{2}}) is active until {{3}}. Member ID: {{4}}. We're excited to have you! Visit us anytime — our team is here to support your fitness journey."

Payment Received (UTILITY):
"Hi {{1}}, your payment of ₹{{2}} has been received. Invoice: {{3}}. Date: {{4}}. Thank you for staying active with Incline Fitness! 💪"
```

**Edge function fix:** Update `manage-whatsapp-templates` create action to auto-map named vars to numbered before sending to Meta.

### Epic 2: Fix Unread Badge Sync
- Normalize phone numbers in auto-read mutation (strip `+` prefix)
- Add `refetchInterval: 30000` to the sidebar unread query as backup
- Fix the auto-read in `WhatsAppChat.tsx` to match both `+91xxx` and `91xxx` formats

### Epic 3: Add Document Type to send-whatsapp
Add `document` branch in the edge function:
```typescript
} else if (message_type === "document") {
  metaPayload.type = "document";
  metaPayload.document = {
    link: media_url,
    ...(caption ? { caption } : { filename: "document" }),
  };
}
```

### Epic 4: Lead Retention — Configurable AI Follow-up
- Add `lead_nurture_config` JSONB column to `organization_settings` with defaults: `{ enabled: true, delay_hours: 4, max_retries: 2, message_template: "..." }`
- Create `lead-nurture-followup` edge function that:
  1. Queries `whatsapp_messages` for leads where last inbound > X hours ago AND outbound was last (AI asked a question)
  2. Sends a gentle nudge via the AI
  3. Tracks retry count in `whatsapp_chat_settings` metadata
- Add UI in Settings > Marketing & Retention tab with configurable delay, max retries, and follow-up message

### Epic 5: Staff Handoff Improvements
- Add "My Chats" filter tab (filters by `assigned_to = current_user_id`)
- Send in-app notification to assigned staff when chat is transferred
- Show "Assigned to: [Name]" badge in the chat list card (not just header)

### Epic 6: Template Variable Mapping in Edge Function
Update `manage-whatsapp-templates` to store a `variable_mapping` alongside each template so the system knows `{{1}} = member_name`, `{{2}} = plan_name`, etc. This mapping is used when sending templates via `send-whatsapp`.

---

## Files Changed

| File | Change |
|---|---|
| **Migration** | Delete all templates, insert 15+ Meta-compatible templates with `{{1}}` format |
| **Migration** | Add `lead_nurture_config` to `organization_settings`, add `nurture_retry_count` to `whatsapp_chat_settings` |
| `supabase/functions/send-whatsapp/index.ts` | Add `document` message type support |
| `supabase/functions/manage-whatsapp-templates/index.ts` | Auto-convert named vars to numbered on create |
| `supabase/functions/lead-nurture-followup/index.ts` | **New** — scheduled follow-up for silent leads |
| `src/pages/WhatsAppChat.tsx` | Fix phone normalization in auto-read, add "My Chats" tab |
| `src/components/layout/AppSidebar.tsx` | Add refetchInterval backup for unread count |
| `src/components/settings/RetentionCampaignManager.tsx` | Add Lead Nurture config UI section |

