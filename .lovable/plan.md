

## Phase F — Meta Integration v25 Hardening

### Audit findings (verified against code, not the user's outdated summary)

| Claim by user | Reality |
|---|---|
| "API still on v18.0" | ❌ False. `send-whatsapp` and `manage-whatsapp-templates` are already on **v25.0** (Phase E). |
| "send-message on old version" | ✅ True — sits at **v23.0**, should align to v25.0. |
| "Instagram = lead webhook only" | ❌ False. `meta-webhook` already ingests IG DMs (with IG-via-Page detection) and `send-message` already replies via Page endpoint. |
| "No webhook signature verification" | ✅ **True and serious** — `handleIncomingEvent` accepts any POST. Anyone with the URL can inject fake messages. |
| "No Instagram comments/mentions/story replies" | ✅ True — only `messages` field is processed. |
| "No Instagram profile sync" | ✅ True — sender name is left as the raw IG ID. |

### F1. Pin a single Graph API version (v25.0)

Create `supabase/functions/_shared/meta-config.ts` exporting `META_GRAPH_VERSION = "v25.0"` and `META_API_BASE`. Replace hard-coded versions in `send-whatsapp`, `send-message`, `manage-whatsapp-templates`, `test-integration`, `meta-webhook`. One source of truth — next bump = one-line change.

### F2. Webhook signature verification (CRITICAL security gap)

In `meta-webhook`, before `handleIncomingEvent` parses the body:
1. Read the raw request text (not parsed JSON).
2. Read `x-hub-signature-256` header.
3. For each active `integration_settings` row of type `whatsapp`/`instagram`/`messenger`, attempt HMAC-SHA256 with that integration's `app_secret`. Accept if any matches.
4. Reject `401` on no match. Log `[meta-webhook] signature mismatch`.
5. If no integration has `app_secret` configured, log a warning and accept (back-compat) so existing setups don't break — surface this in the Integration UI as an amber banner.

### F3. Instagram comments + mentions + story replies

Extend `meta-webhook` to handle the additional Instagram subscription fields beyond `messages`:
- `comments` → ingest as platform `instagram` with `message_type="comment"`, store post/comment IDs in `metadata` JSONB. Trigger AI auto-reply only if org setting `instagram_auto_reply_comments` is enabled.
- `mentions` → ingest with `message_type="mention"`.
- `story_insights` (story replies arrive as DMs already, this is just engagement signals — log to `whatsapp_messages` as `message_type="story_reply"` when `messaging.story` is present in payload).

Add `message_type` column allowance check (already exists; no migration needed — verified). Update inbox UI tag to render comment/mention badges.

### F4. Resolve Instagram sender profile

When a new IG sender ID arrives and we don't have a friendly name:
- Call `GET /{ig_user_id}?fields=name,username,profile_pic` using the page access token.
- Cache result on `whatsapp_messages.sender_name` and a new lightweight `whatsapp_contacts` upsert (already exists).

Falls back gracefully when token lacks `instagram_manage_messages` scope (logs warning, continues).

### F5. Subscription field documentation

Add `supabase/functions/meta-webhook/SUBSCRIPTION_FIELDS.md` listing the exact webhook fields to subscribe in Meta App Dashboard:
- WhatsApp Business Account: `messages`, `message_template_status_update`
- Instagram (under Page product): `messages`, `messaging_postbacks`, `messaging_referrals`, `messaging_reactions`, `comments`, `mentions`, `message_reactions`
- Page (Messenger): `messages`, `messaging_postbacks`, `messaging_referrals`

Plus the required Meta App permissions: `whatsapp_business_messaging`, `whatsapp_business_management`, `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, `pages_messaging`, `pages_read_engagement`, `pages_manage_metadata`.

### F6. End-to-end curl validation

Through `supabase--curl_edge_functions`:
1. `meta-webhook` POST without signature → expect 401 (after F2 ships, when at least one integration has app_secret).
2. `meta-webhook` POST with valid HMAC → 200 + row inserted.
3. `meta-webhook` POST simulated IG `comments` field → row with `message_type='comment'`.
4. `send-message` POST IG → confirm v25.0 URL in logs.
5. `send-whatsapp` POST template → confirm v25.0 URL in logs.

---

### Files touched

| File | Change |
|---|---|
| `supabase/functions/_shared/meta-config.ts` (new) | Single Graph version constant |
| `supabase/functions/send-message/index.ts` | Use shared version (v23 → v25) |
| `supabase/functions/send-whatsapp/index.ts` | Use shared version |
| `supabase/functions/manage-whatsapp-templates/index.ts` | Use shared version |
| `supabase/functions/test-integration/index.ts` | Use shared version |
| `supabase/functions/meta-webhook/index.ts` | F1 version, F2 signature verify, F3 comments/mentions, F4 profile resolve |
| `supabase/functions/meta-webhook/SUBSCRIPTION_FIELDS.md` (new) | F5 setup reference |
| `src/components/settings/IntegrationSettings.tsx` | Amber banner if `app_secret` missing (signature verify cannot enforce) |

### Verification gates

- ✅ All 5 curl tests pass.
- ✅ Forged webhook POST rejected with 401 once any integration has `app_secret`.
- ✅ A test comment on the IG business account produces a `whatsapp_messages` row with `message_type='comment'`.
- ✅ Inbox shows resolved IG handle (e.g. "@theinclinelife") instead of raw numeric ID.
- ✅ All Meta API calls in logs use `v25.0`.

