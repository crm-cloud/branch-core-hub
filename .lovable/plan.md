# Root Cause Analysis & Fix Plan

## Critical Finding: WHY You Can't Receive Messages

**The `whatsapp-webhook` function is MISSING from `supabase/config.toml`.**

This means it defaults to `verify_jwt = true`. When Meta sends a POST webhook request, it does NOT include a Supabase JWT token — so Supabase's API gateway rejects the request with **401 Unauthorized** before your edge function code even runs. This is why:

- Zero inbound messages exist in the database (all 7 messages are outbound)
- Zero edge function logs for `whatsapp-webhook` — the code never executes
- Sending works fine (the latest "hi" message has status "read", confirming Meta's API works)

**Fix:** Add `[functions.whatsapp-webhook] verify_jwt = false` to `config.toml`. This is the same pattern used for `payment-webhook`, `mips-webhook-receiver`, and other external webhook receivers.

---

## Implementation Plan

### 1. Fix Webhook (The Critical One-Line Fix)

**File:** `supabase/config.toml`

- Add `[functions.whatsapp-webhook]` with `verify_jwt = false`
- Also add `[functions.manage-whatsapp-templates]` with `verify_jwt = false` (it's also missing, causing the template sync auth errors)

### 2. Fix WhatsApp FAB Phone Number

**File:** `src/pages/PublicWebsite.tsx`

- The FAB currently links to `https://wa.me/?text=...` with NO phone number
- Fix: fetch the phone number from `integration_settings` config or `organization_settings`, and inject it into the `wa.me/<phone>` URL
- If no phone configured, hide the FAB

### 3. WhatsApp Chat UI Improvements

**File:** `src/pages/WhatsAppChat.tsx`

- The bot toggle and core chat functionality already exist
- Add a "Convert to Lead" quick-action button in the chat header that opens a drawer pre-filled with the contact's phone number
- Improve auto-scroll behavior on new messages
- Add message type indicators for non-text messages (image, template badges)

### 4. Template Dashboard in Settings

**File:** `src/components/settings/IntegrationSettings.tsx`

- Add a "Templates" sub-tab in the WhatsApp section showing data from `whatsapp_templates` table
- Columns: Name, Language, Category, Status badge (APPROVED/REJECTED/PENDING), Quality Score
- "Sync Templates" button calls `manage-whatsapp-templates` with `action: 'list'`

---

## Files Changed


| File                                              | Change                                                                           |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `supabase/config.toml`                            | Add `whatsapp-webhook` and `manage-whatsapp-templates` with `verify_jwt = false` |
| `src/pages/PublicWebsiteV1.tsx`                   | Fix FAB to use dynamic phone number from DB                                      |
| `src/pages/WhatsAppChat.tsx`                      | Add "Convert to Lead" button, message type badges                                |
| `src/components/settings/IntegrationSettings.tsx` | Add template dashboard table                                                     |


No database migrations needed. No edge function code changes needed — the webhook code is correct, it was just never reached.