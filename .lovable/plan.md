

## Phase E — Meta (IG/FB) deep audit + WhatsApp trigger repair

### E1. Fix Instagram inbound webhook routing (REAL ISSUE)

**Finding:** `whatsapp_messages` contains zero real Instagram messages — only synthetic `IG_TEST_*` rows from earlier curl tests. Real DMs from `@theinclinelife` never reached the CRM.

**Root cause (per latest Meta docs):** With "Instagram Login via Facebook Login for Business" (the current standard for Page-linked IG Business accounts), Meta delivers DMs as `object: "page"` with the Page ID as recipient — same envelope as Messenger. Our router only routes `object: "instagram"` events to `processInstagramEvent`. IG-with-Pages traffic falls into `processMessengerEvent` and gets stored as platform `messenger` (or filtered out).

**Fix:**
- Inside `processMessengerEvent`, detect Instagram-origin events by matching `recipient.id` against any active `integration_settings.instagram` row's `page_id` / `instagram_account_id`. Re-route to IG handler with `platform = "instagram"`.
- In `meta-webhook` GET verifier: also accept the new `field: "messages"` subscription used for IG (no code change needed, just verify config).
- Add structured logging (`console.log` with `[IG]`/`[FB]` prefix + sender/recipient/page IDs) so future diagnosis takes seconds.

### E2. Fix Instagram outbound send (failed: 1)

**Finding:** Existing IG outbound row is `failed`. `send-message` posts to `https://graph.facebook.com/v25.0/{ig_id}/messages` with `messaging_product:"instagram"`. Per current Meta docs (Apr 2025), IG messages must be sent via the **Page** endpoint when the IG account is connected through a Facebook Page:
```
POST /v23.0/{PAGE_ID}/messages   (NOT /{IG_ID}/messages)
body: { recipient:{id}, message:{text}, messaging_type:"RESPONSE" }
```
Only standalone IG Business accounts (with IG User Access Token, no Page) use the IG-account endpoint.

**Fix:** Update `send-message/index.ts` Instagram branch to:
1. Try `POST /{page_id}/messages` first (Page-linked, the common case).
2. Fall back to `POST /{ig_id}/messages` with `messaging_product:"instagram"` only if `page_id` is absent.
3. Accept image/audio/video attachments using the new `attachment` payload format (max 25 MB, public URL).
4. Surface the actual Meta `error.code` + `error.error_subcode` in the message row's `error` column for UI debugging.

### E3. Unified AI brain across WhatsApp + IG + FB

**Status:** `meta-webhook` already calls `getAllToolDefinitions()` and `executeSharedToolCall` — same brain as `whatsapp-webhook`. ✅
**Gap:** History query in `meta-webhook` filters by `platform=eq.{platform}`, so a customer who messages on both IG and WhatsApp gets two disjoint memories.

**Fix:** Build conversation history by `phone_number` (the IG/FB sender ID is stored there) without platform filter, but tag each turn with `(via {platform})` in the system prompt so the model knows context. Identifier dedup remains per-platform via `platform_message_id`.

### E4. App Secret Proof — verify on save, not just test

**Finding:** Test Connection succeeds without `appsecret_proof` (fallback). UI doesn't warn when the app has "Require App Secret Proof for Server API calls" enabled in Meta — calls will silently fail later.

**Fix:** In `test-integration`, when `app_secret` is provided AND fallback path was used (proof failed), return `{ success: true, warning: "..." }` so the UI shows an amber banner: *"Connected, but app_secret proof rejected — verify your app secret matches the one in Meta Dashboard → App Settings → Basic"*.

### E5. WhatsApp automation triggers — broken silently

**Finding:**
- `whatsapp_triggers` table has **0 rows** (zero configured triggers).
- `autoSendWhatsAppTemplate` (in `WhatsAppTemplateDrawer.tsx`) queries `templates.channel = 'whatsapp'` and `templates.trigger_event = ?` — neither column exists on the `templates` table (real columns are `type` and there is no `trigger_event`). Every call fails silently in its `catch{}` block.
- 27 approved WhatsApp templates exist but nothing wires events → templates → sends.

**Fix:**
1. Rewrite `autoSendWhatsAppTemplate` to:
   - Look up `whatsapp_triggers` by `event_name` + `branch_id` (with global fallback when branch row missing).
   - Join template, replace `{{var}}` placeholders, insert message, invoke `send-whatsapp`.
2. Migration to seed sensible defaults in `whatsapp_triggers` mapped to existing approved templates: `member_created` → "New Member Welcome", `payment_received` → "Payment Received", `lead_created` → "Lead Welcome", `membership_expiring_7d` → "Renewal Reminder 7 Days", `membership_expiring_1d` → "Renewal Reminder 1 Day", `membership_expired` → "Membership Expired", `pt_session_booked` → "PT Session Booked", `class_booked` → "Class Booking Confirmed", `feedback_request` → "Feedback Request", `birthday` → "Birthday Wish", `freeze_confirmed` → "Freeze Confirmation", `unfreeze_confirmed` → "Unfreeze Confirmation", `referral_reward` → "Referral Reward".
3. Remove the silent `catch {}` — log to `communication_logs` so failures are auditable.

### E6. End-to-end curl validation

After deploy, run live curl tests through `supabase--curl_edge_functions`:
1. `meta-webhook` GET verification with the saved Instagram verify token → 200 + challenge echo.
2. `meta-webhook` POST simulated **Page-object IG** event (real Meta envelope) → assert one inbound row appears with `platform='instagram'`.
3. `meta-webhook` POST real IG `object:"instagram"` event → same assertion.
4. `send-message` POST `platform:"instagram"` with the real IG sender ID → check Meta returns `message_id`, row updates to `sent`.
5. Trigger fake `member_created` event → assert `whatsapp_messages` row created via `autoSendWhatsAppTemplate`.

---

## Files touched

| File | Change |
|---|---|
| `supabase/functions/meta-webhook/index.ts` | E1 IG-via-Page detection + cross-platform history (E3) + structured logging |
| `supabase/functions/send-message/index.ts` | E2 Page-endpoint primary route, IG-account fallback, surface Meta error codes |
| `supabase/functions/test-integration/index.ts` | E4 return warning when proof-fallback used |
| `src/components/communication/WhatsAppTemplateDrawer.tsx` | E5 rewrite `autoSendWhatsAppTemplate` against real schema |
| `src/components/settings/IntegrationConfigSheet.tsx` (or equivalent) | E4 amber banner on warning response |
| `supabase/migrations/<new>.sql` | E5 seed default `whatsapp_triggers` rows |

## Verification gates

- ✅ Sending a real DM from Instagram now creates a row in `whatsapp_messages` with `platform='instagram'`, `direction='inbound'`.
- ✅ Sending a reply from CRM updates the row to `status='sent'` with a real `mid_*` `platform_message_id`.
- ✅ Creating a test member fires `New Member Welcome` template via the WhatsApp send pipeline.
- ✅ All 5 curl tests in E6 return success.

