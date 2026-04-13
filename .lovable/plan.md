

# Plan: Omnichannel Meta Refinement, Integration UI, Unified Inbox UX & Nurture Fix

## Audit Results

### Lead Nurture: Why "5 hours ago" and appears stuck
- **The cron IS running hourly** (confirmed via `cron.job_run_details` — all succeeded).
- **The function executes and returns `nudged: 0`** because:
  - Most chats have `bot_active: false` → skipped
  - The 2 chats with `bot_active: true` have `nurture_retry_count >= max_retries (2)` → skipped
  - Phone `918769321006` hit retry count 3 (max is 2), so permanently skipped
  - Phone `919887601200` hit retry count 2 = max, so also skipped
- **Fix**: The retry counter never resets when the user replies. Once maxed, that chat is permanently excluded from nurture even if a new conversation starts.
- **partial_lead_data corruption**: One record shows `goal: "from the options below?"` — the AI captured button prompt text instead of actual user selection (the JSON leak bug bleeding into partial data extraction).

### Meta Webhook & Send Message
- Already exist and are functional. `meta-webhook` handles IG/Messenger, `send-message` dispatches per platform.
- Missing: Instagram/Messenger provider schemas in `providerSchemas.ts` (no config fields defined).
- Missing: Webhook URLs for IG/Messenger in `getWebhookInfoForProvider`.

### Integration Settings UI
- No Instagram or Messenger tabs/providers in the WhatsApp section.
- No way to configure IG/Messenger credentials from the UI.

---

## Implementation

### Module 1: Fix Lead Nurture (the real bug)

**File: `supabase/functions/lead-nurture-followup/index.ts`**
- Reset `nurture_retry_count` to 0 when the last message is **inbound** (user replied) — currently only checks outbound
- Add `lastMsg.created_at > cutoffTime` skip only when direction is outbound; if last msg is inbound, the user has re-engaged so reset counter
- Add a `nurture_cooldown_hours` check: skip if `last_nurture_at` is within cooldown window (prevent double-nudge)
- Fix the condition: currently `lastMsg.created_at > cutoffTime` uses wrong comparison direction (should be `<` for "older than cutoff")

**File: `src/components/settings/LeadNurtureSettings.tsx`**
- Show actual last run result (nudged count) from edge function logs or a stored value
- Add "Reset All Retry Counters" button for admin to manually re-enable nurture for stale leads

### Module 2: Instagram & Messenger Provider Schemas

**File: `src/config/providerSchemas.ts`**
- Add `instagram_meta` schema: fields for Instagram Business Account ID, Page Access Token, Webhook Verify Token
- Add `messenger_meta` schema: fields for Facebook Page ID, Page Access Token, Webhook Verify Token
- Update `getWebhookInfoForProvider` to return `meta-webhook` URL for instagram and messenger types
- Update `getProviderDisplayName` for instagram/messenger entries

### Module 3: Integration Settings — Omnichannel Tabs

**File: `src/components/settings/IntegrationSettings.tsx`**
- Add `INSTAGRAM_PROVIDERS` and `MESSENGER_PROVIDERS` arrays
- Add new tabs: "Instagram" and "Messenger" alongside existing WhatsApp tab (with platform logos)
- Each tab shows its own webhook URL (pointing to `meta-webhook`) and provider config cards
- Add connection status indicator: query `whatsapp_messages` for recent platform-specific activity to show "Live" pulse

**File: `src/pages/Integrations.tsx`**
- Add Instagram and Messenger provider cards if this page also has integration management

### Module 4: Unified Inbox UX Enhancements

**File: `src/pages/WhatsAppChat.tsx`**
- **Platform-colored chat header**: WhatsApp = green accent bar, Instagram = pink/purple gradient, Messenger = blue
- **Avatar overlay badges**: Small platform icon (Instagram/Messenger/WhatsApp) overlaying contact avatar in sidebar
- **Lead source badge**: Show "via Instagram" / "via Messenger" / "via WhatsApp" badge next to contact name
- **Platform filter tabs**: Already exist (`'whatsapp' | 'instagram' | 'messenger'` in ChatFilter) — verify they actually filter by the `platform` column in queries
- **Bot toggle per-platform**: Ensure the bot active toggle works per phone_number + platform combination (current unique constraint is `branch_id, phone_number` — may need platform awareness)

### Module 5: Meta Webhook Hardening

**File: `supabase/functions/meta-webhook/index.ts`**
- Add `appsecret_proof` computation for IG/Messenger API calls (consistency with WhatsApp)
- Use the org's AI system prompt from `organization_settings.whatsapp_ai_config` instead of a generic hardcoded prompt
- Add tool-calling support for IG/Messenger (reference the same Gemini tool registry used in `whatsapp-webhook`)

---

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/lead-nurture-followup/index.ts` | Fix retry reset on user reply, add cooldown check |
| `src/components/settings/LeadNurtureSettings.tsx` | Add reset counters button, show real run stats |
| `src/config/providerSchemas.ts` | Add instagram/messenger provider schemas + webhook URLs |
| `src/components/settings/IntegrationSettings.tsx` | Add Instagram & Messenger tabs with config UI |
| `src/pages/WhatsAppChat.tsx` | Platform-colored headers, avatar badges, source labels |
| `supabase/functions/meta-webhook/index.ts` | Use org AI config, harden with appsecret_proof |

No database migrations required — the `platform` column and `messaging_platform` enum already exist.

