

# WhatsApp API Auth Fix, AI Chatbot & 2-Way CRM Inbox

## Root Cause (from actual edge function logs)

The error is **NOT** a missing `Authorization` header. The logs show:

```
"API calls from the server require an appsecret_proof argument"
```

This is Meta's `appsecret_proof` security feature. When enabled in the Meta Developer Dashboard, every Graph API call must include an `appsecret_proof` query parameter — an HMAC-SHA256 hash of the `access_token` using the `app_secret`. The DB already stores `app_secret` in `credentials.app_secret` on the `custom` provider row, but **neither `send-whatsapp` nor `manage-whatsapp-templates` compute or send this proof**.

## Implementation Plan

### Epic 1: Fix Meta API Auth (`appsecret_proof`)

**Files:** `send-whatsapp/index.ts`, `manage-whatsapp-templates/index.ts`, `whatsapp-webhook/index.ts` (AI auto-reply section)

Changes to all three edge functions:
- After fetching `integration_settings`, extract `credentials.app_secret` alongside `access_token`
- Compute `appsecret_proof = HMAC-SHA256(access_token, app_secret)` using `crypto.subtle`
- Append `?appsecret_proof=<hash>` to every `graph.facebook.com` URL
- If `app_secret` is absent, skip the proof (backward compatible for apps without it enabled)
- Wrap all Meta `fetch` calls in try/catch and log failures to `error_logs` table with `source: 'edge_function'`, `component_name: 'send-whatsapp'`, and the HTTP status + Meta error message
- Also update `providerSchemas.ts` to add `app_secret` field to `whatsapp_meta_cloud` schema so users can configure it from Settings UI

### Epic 2: AI Auto-Reply — Already Working

The `ai-auto-reply` edge function already uses the Lovable AI Gateway with `google/gemini-3-flash-preview`. The `whatsapp-webhook` already triggers auto-reply on inbound messages using the same gateway. No rewrite to "Gemini API directly" is needed — Lovable AI Gateway already proxies to Gemini.

**Minor improvement:** Update `ai-auto-reply` to also read the custom `system_prompt` from `organization_settings.whatsapp_ai_config` instead of using only its hardcoded prompt — aligning it with the webhook auto-reply behavior.

### Epic 3: Human Handoff & Bot Toggle

**Database migration:**
- Add `bot_active` column to `whatsapp_messages` — but actually, bot state should be per-conversation (per phone number), not per message. Better approach: add a `bot_paused_contacts` JSONB array to `organization_settings.whatsapp_ai_config`, or create a lightweight `whatsapp_conversations` table with `phone_number`, `branch_id`, `bot_active` (default true).

**Chosen approach:** Add a `whatsapp_chat_settings` table:
```sql
CREATE TABLE whatsapp_chat_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id),
  phone_number text NOT NULL,
  bot_active boolean DEFAULT true,
  paused_at timestamptz,
  paused_by uuid REFERENCES auth.users(id),
  UNIQUE(branch_id, phone_number)
);
```

**Edge function changes (`whatsapp-webhook`):**
- Before triggering AI auto-reply, check `whatsapp_chat_settings` for the contact — if `bot_active = false`, skip auto-reply.

**UI changes (`WhatsAppChat.tsx`):**
- Add a `Switch` toggle in the chat header area: "AI Bot Active / Paused" for the selected contact
- When staff sends a manual message, auto-set `bot_active = false` for that contact (insert/upsert into `whatsapp_chat_settings`)
- Toggle allows staff to re-enable the bot

### Epic 4: Template Sync Dashboard

The `manage-whatsapp-templates` function already syncs to the `whatsapp_templates` table correctly. The auth fix from Epic 1 will make it work.

**UI (`IntegrationSettings.tsx` — WhatsApp tab):**
- Add a "Templates" sub-section showing a data table from `whatsapp_templates`: Name, Language, Category, Status badge (APPROVED/REJECTED/PENDING), Quality Score
- "Sync Templates from Meta" button calls `manage-whatsapp-templates` with `action: 'list'`
- Use Realtime subscription on `whatsapp_templates` for live status updates

### Epic 5: WhatsApp FAB on Public Website

**File:** `PublicWebsiteV1.tsx`

- Add a floating action button (fixed bottom-right) with WhatsApp icon
- Fetch the business phone number dynamically from `organization_settings` or `integration_settings` (config.phone_number_id won't work — need actual display phone number from `organization_settings.phone` or similar)
- Link format: `https://wa.me/<phone>?text=Hi%20Incline%20Gym%2C%20I%20would%20like%20to%20know%20more!`
- Fallback: if no phone configured, hide the FAB
- Style: green circle with WhatsApp icon, subtle pulse animation

---

## Files Changed

| File | Change |
|---|---|
| **Migration** | Create `whatsapp_chat_settings` table |
| `supabase/functions/send-whatsapp/index.ts` | Add `appsecret_proof` computation + error logging |
| `supabase/functions/manage-whatsapp-templates/index.ts` | Add `appsecret_proof` computation + error logging |
| `supabase/functions/whatsapp-webhook/index.ts` | Add `appsecret_proof` to AI auto-reply Meta calls + check `bot_active` before auto-reply |
| `supabase/functions/ai-auto-reply/index.ts` | Read system prompt from `organization_settings.whatsapp_ai_config` |
| `src/config/providerSchemas.ts` | Add `app_secret` field to `whatsapp_meta_cloud` schema |
| `src/pages/WhatsAppChat.tsx` | Add bot toggle switch + auto-pause on manual send |
| `src/components/settings/IntegrationSettings.tsx` | Add template dashboard table in WhatsApp tab |
| `src/pages/PublicWebsiteV1.tsx` | Add WhatsApp FAB |

## What Stays Unchanged
- All existing routes, auth, role system
- Database schema for `whatsapp_messages`, `integration_settings`, `whatsapp_templates`
- `send-sms`, `notify-lead-created`, and other edge functions
- WhatsApp webhook verification (GET) flow
- Existing chat UI layout and realtime subscriptions

