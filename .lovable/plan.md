

# Plan: Deep Audit Fixes + Team Inbox + Meta Ads + AI Flow Builder

## Build Errors (Fix First)

1. **`vite.config.ts` line 10**: `allowedHosts: true` — Vite 5 types require `true` as literal `true` or `string[]`. Fix: cast to `true as const`.
2. **`whatsapp-webhook/index.ts` line 1665**: `fallbackBranchIdCache` typed `string | null | undefined` but return type is `string | null`. Fix: change the variable type to `string | null` and initialize to `null`, using a separate boolean sentinel for "not yet fetched".

## Module 1: Fix Invoice GST Toggle Logic

**Problem:** `CreateInvoiceDrawer.tsx` always defaults `includeGst: true` regardless of org settings. HSN codes from `TaxGstSettings` are not populated on invoice items.

**Fix:**
- Fetch `organization_settings.gst_rates` and `hsn_defaults` in `CreateInvoiceDrawer.tsx`; default `includeGst` based on whether org has GST configured
- Add `hsn_code` field per line item in the drawer UI, pre-populated from category defaults
- Pass `hsn_code` when inserting `invoice_items`
- Same fix in `PurchaseMembershipDrawer.tsx`

## Module 2: Update ai-auto-reply with Conversation Memory

**Problem:** `ai-auto-reply` receives `recent_messages` from the frontend but doesn't fetch from DB. The frontend already sends last 10 messages, but the edge function should also hydrate from `whatsapp_messages` for the sender.

**Fix:**
- In `ai-auto-reply/index.ts`, after auth, query `whatsapp_messages` for the given `phone_number` (last 10, ordered ASC) as fallback/supplement when `recent_messages` is sparse
- Include `platform` awareness so it works across unified messages

## Module 3: Meta Ads Attribution

**Schema:** Add `ad_id`, `campaign_name` columns to `leads` table (migration).

**Webhook:** In `whatsapp-webhook/index.ts`, extract `referral` payload from Meta webhook entry (Meta sends ad click context in `entry[].changes[].value.messages[].referral`). Populate `ad_id`, `campaign_name` on lead capture.

**UI:** Add a small "Ad Attribution" card in the Leads analytics section (`LeadAnalytics.tsx`) showing leads per campaign. No separate page — just extend existing analytics.

## Module 4: Team Inbox Collaboration

### 4a: Internal Notes (Whisper Mode)
- Add `is_internal_note` boolean column to `whatsapp_messages` (migration, default false)
- In `WhatsAppChat.tsx`, add a toggle button next to the send box: "Internal Note" mode
- When toggled on, insert message with `is_internal_note: true` and do NOT call `send-whatsapp`
- Render internal notes with a distinct yellow/amber background and "Staff Only" badge
- Filter internal notes from customer-visible queries in the webhook

### 4b: Quick Replies (Slash Commands)
- When user types `/` in the message input, show a popover with templates from `templates` table
- Filter templates as user types (e.g., `/price` filters to pricing templates)
- On select, insert template content into the message box
- Reuse existing `templates` query already in use by `BroadcastDrawer`

### 4c: Assigned Staff Avatar on Chat List
- Join `whatsapp_chat_settings.assigned_to` with `profiles` to get avatar/name
- Show a small avatar overlay on each chat card in the sidebar for assigned staff

### 4d: Lead Response Time Metric
- In lead analytics, calculate time between AI handoff (`bot_active` set to false / `transfer_to_human` tool log) and first staff outbound message
- Highlight in red if > 5 minutes

## Module 5: AI Flow Builder (Simplified Card-Based)

**Not a full node editor** — that's too complex and fragile. Instead:
- Create `AIFlowRules` component in settings: a list of trigger-response cards
- Each card: Trigger keyword/phrase → Response action (send template, send text with buttons, assign to staff)
- Store rules in `organization_settings.ai_flow_rules` (JSONB array)
- In `whatsapp-webhook`, before the main AI call, check incoming message against flow rules for exact/fuzzy keyword matches. If matched, execute the rule action instead of calling Gemini.

## Module 6: Broadcast Center (Unified)

**Not building a full "Global Broadcast Center" page** — extend existing `BroadcastDrawer`:
- Add a "Cross-Channel" mode: when enabled, the single message sends to:
  - WhatsApp via existing `send-broadcast`
  - Email via existing `send-broadcast` with `channel: 'email'`
  - Instagram/Messenger DMs via `send-message` for active leads on those platforms
- Add an optional "Update Website Banner" toggle that upserts a row in `announcements` table with `is_banner: true`

## Files Changed

| File | Change |
|---|---|
| `vite.config.ts` | Fix `allowedHosts` type |
| `supabase/functions/whatsapp-webhook/index.ts` | Fix type error, add Meta ads referral extraction, add flow rules check |
| `supabase/functions/ai-auto-reply/index.ts` | Add DB message history fetch |
| `src/components/invoices/CreateInvoiceDrawer.tsx` | HSN code per item, GST default from org settings |
| `src/components/members/PurchaseMembershipDrawer.tsx` | HSN code support |
| `src/pages/WhatsAppChat.tsx` | Internal notes toggle, slash commands, assigned staff avatar, platform send routing |
| `src/components/leads/LeadAnalytics.tsx` | Ad attribution chart, response time metric |
| `src/components/settings/AIFlowBuilderSettings.tsx` | Trigger-response rule cards |
| `src/components/announcements/BroadcastDrawer.tsx` | Cross-channel mode |
| Migration | `ad_id`/`campaign_name` on leads, `is_internal_note` on whatsapp_messages |

## What I'm deliberately NOT building
- Full visual node-based flow editor (too complex, fragile; card-based rules achieve the same goal)
- Member self-service renewal portal (separate epic, needs dedicated member-facing auth flow)
- Typing indicators (Meta API doesn't expose user typing; staff typing would need presence channels — deferred)
- "Flame" icon for paid ad leads (will add a badge instead — simpler, same signal)

