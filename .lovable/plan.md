

# WhatsApp Business API Overhaul & AI Chatbot Integration

## Current State Assessment

The codebase already has solid foundations:
- `send-whatsapp` edge function correctly fetches credentials from `integration_settings` JSONB and calls Meta Cloud API v18.0 with proper `Bearer` auth headers
- `whatsapp-webhook` handles GET verification and POST inbound messages + status updates
- `manage-whatsapp-templates` supports list/create/get_status actions against Meta API
- `WhatsAppChat.tsx` has a working two-way chat UI with Supabase Realtime subscriptions
- `ai-auto-reply` edge function provides AI suggestion via Lovable AI Gateway
- `whatsapp_messages` table tracks all messages with `whatsapp_message_id`, `status`, `direction`

**Actual gaps identified:**
1. `send-whatsapp` only sends `text` type — no image or template message support
2. `whatsapp-webhook` doesn't handle `message_template_status_update` events
3. AI auto-reply is manual (suggestion only) — no automatic reply on inbound
4. No dedicated `whatsapp_templates` table — templates live in generic `templates` table with `meta_template_*` columns
5. No AI auto-reply toggle/settings stored in DB
6. `send-whatsapp` stores Meta's `whatsapp_message_id` in `external_id` column (which doesn't exist in the schema — it only has `whatsapp_message_id`)

---

## Epic 1: Core Send Engine Enhancement

### Edge Function: `send-whatsapp/index.ts`
- Add support for `message_type` parameter: `text` (default), `image`, `template`
- For `image`: accept `media_url` + optional `caption`, build Meta image payload
- For `template`: accept `template_name`, `language`, `template_components`, build Meta template payload
- Fix: update `whatsapp_message_id` column (not `external_id`) with Meta's response ID
- Keep existing text flow unchanged

### No auth fix needed
The current auth flow is correct — `Bearer ${accessToken}` with `Content-Type: application/json`. The real issue users hit is likely missing/wrong credentials in `integration_settings`. No code change needed for auth itself.

---

## Epic 2: Template Sync & Management Dashboard

### Database Migration
Create a dedicated `whatsapp_templates` table:
```sql
CREATE TABLE whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id),
  waba_id text NOT NULL,
  meta_template_id text,
  name text NOT NULL,
  language text DEFAULT 'en',
  category text,
  status text DEFAULT 'PENDING',
  quality_score text,
  rejected_reason text,
  components jsonb,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
-- Enable realtime for live template status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_templates;
```
Add RLS policies for staff-level access.

### Edge Function: `manage-whatsapp-templates/index.ts`
- Update `list` action to upsert into `whatsapp_templates` table (not the generic `templates` table)
- Include `quality_score` field from Meta API response
- Keep backward compatibility with existing `templates` table meta columns

### UI: Add "Template Management" section in WhatsApp tab of IntegrationSettings
- Show a table with: name, language, category, status badge (APPROVED/REJECTED/PENDING), quality score
- "Force Sync" button calls the `list` action
- Use Supabase Realtime on `whatsapp_templates` for live status badge updates

---

## Epic 3: Webhook Payload Parsing (Two-Way Sync)

### Edge Function: `whatsapp-webhook/index.ts`
Currently handles:
- ✅ Incoming messages → saved to `whatsapp_messages` as `inbound`
- ✅ Status updates (sent/delivered/read) → updates `whatsapp_messages.status`

**Add:**
- Parse `message_template_status_update` events from `entry[].changes[].value`
- When detected, update `whatsapp_templates` table: set `status` and `rejected_reason`
- After saving an inbound message, check AI auto-reply settings and trigger auto-reply if enabled (Epic 5)

---

## Epic 4: Real-Time Two-Way Chat UI Improvements

The chat UI already exists and works with Realtime. Improvements:

### `WhatsAppChat.tsx`
- **Delivery status ticks are already implemented** (sent → single check, delivered → double check, read → blue double check) — no changes needed
- Add unread count tracking: when selecting a contact, mark their messages as "read" in DB
- Add typing indicator placeholder
- Show `message_type` icons for non-text messages (image, template)

---

## Epic 5: AI Gym Assistant (Auto-Reply)

### Database Migration
Add AI settings to `organization_settings` or a new JSONB field:
```sql
ALTER TABLE organization_settings 
  ADD COLUMN IF NOT EXISTS whatsapp_ai_config jsonb DEFAULT '{}';
```
Structure: `{ "auto_reply_enabled": false, "system_prompt": "...", "reply_delay_seconds": 5 }`

### Settings UI: New component `WhatsAppAISettings.tsx`
- Toggle: "Enable AI Auto-Reply"
- Textarea: "AI System Prompt / Gym Context" (pre-filled with gym info template)
- Number input: Reply delay (seconds)
- Placed in WhatsApp tab of IntegrationSettings

### Edge Function: `whatsapp-webhook/index.ts` (update)
After saving an inbound message:
1. Check `organization_settings.whatsapp_ai_config.auto_reply_enabled`
2. If enabled, fetch recent conversation history from `whatsapp_messages`
3. Call Lovable AI Gateway with the configured system prompt + conversation
4. Send the AI response back via `send-whatsapp` edge function
5. Save the AI response as an outbound message in `whatsapp_messages`
6. All wrapped in try/catch — failure never blocks inbound message processing

---

## Implementation Order

1. **Migration**: `whatsapp_templates` table + `whatsapp_ai_config` column on `organization_settings`
2. **Epic 1**: Update `send-whatsapp` for image + template message types, fix `whatsapp_message_id` column
3. **Epic 3**: Update `whatsapp-webhook` for template status events + AI auto-reply trigger
4. **Epic 2**: Update `manage-whatsapp-templates` to use new table, add Template Management UI
5. **Epic 5**: Create `WhatsAppAISettings.tsx`, add to IntegrationSettings WhatsApp tab
6. **Epic 4**: Minor chat UI enhancements

## Files Created/Modified

| File | Action |
|---|---|
| DB Migration | `whatsapp_templates` table, `whatsapp_ai_config` column |
| `supabase/functions/send-whatsapp/index.ts` | Add image + template message types |
| `supabase/functions/whatsapp-webhook/index.ts` | Add template status parsing + AI auto-reply |
| `supabase/functions/manage-whatsapp-templates/index.ts` | Upsert to `whatsapp_templates` table |
| `src/components/settings/WhatsAppAISettings.tsx` | New — AI toggle + prompt config |
| `src/components/settings/IntegrationSettings.tsx` | Add template dashboard table, AI settings |
| `src/pages/WhatsAppChat.tsx` | Minor: message type icons, unread tracking |
| `supabase/config.toml` | No changes needed (webhook already `verify_jwt = false`) |

## What Stays Unchanged
- All existing routes and auth flow
- `send-sms`, `notify-lead-created`, and other edge functions
- Existing `templates` table and TemplateManager component
- Branch-aware behavior and role-based access
- WhatsApp webhook verification (GET) flow

