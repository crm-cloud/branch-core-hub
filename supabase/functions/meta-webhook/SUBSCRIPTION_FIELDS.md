# Meta Webhook Subscription Fields & Permissions (v25.0)

This is the canonical reference for configuring the Meta App Dashboard so that
the `meta-webhook` edge function receives every supported event for WhatsApp,
Instagram, and Facebook Messenger.

## 1. Webhook URLs

| Object | URL |
|---|---|
| `whatsapp_business_account` | `https://<project>.supabase.co/functions/v1/whatsapp-webhook` |
| `instagram` | `https://<project>.supabase.co/functions/v1/meta-webhook` |
| `page` (Messenger + IG-via-Page) | `https://<project>.supabase.co/functions/v1/meta-webhook` |

The `verify_token` for each webhook must match the `webhook_verify_token` field
saved in the corresponding **Integration Settings** row in the CRM.

## 2. Required webhook subscription fields

### WhatsApp Business Account
- `messages` — inbound messages, status updates
- `message_template_status_update` — template approval state changes

### Instagram (subscribe under the **Instagram** product, not Page)
- `messages` — DMs (text, attachments, story replies arrive here)
- `messaging_postbacks` — quick reply / CTA clicks
- `messaging_referrals` — ad-driven conversation referrals (CTM)
- `messaging_reactions` — reactions on DMs
- `comments` — comments on the IG business account's media
- `mentions` — `@mentions` of the business in stories or feed
- `message_reactions` — alias used in some app versions

### Page (subscribe under the **Messenger** / **Pages** product)
- `messages` — Messenger DMs
- `messaging_postbacks`
- `messaging_referrals`
- `feed` — optional, for Page comments

> Pages also forward Instagram DMs when "Instagram Login via Facebook Page" is
> enabled. Our webhook auto-detects this by matching the recipient/sender ID
> against active Instagram integration `page_id` / `instagram_account_id`.

## 3. Required Meta App permissions

Request these scopes for the System User access token used by all integrations:

| Permission | Used for |
|---|---|
| `whatsapp_business_messaging` | Send/receive WhatsApp messages |
| `whatsapp_business_management` | Manage templates, phone numbers |
| `instagram_basic` | Read IG account profile |
| `instagram_manage_messages` | Send/receive IG DMs, resolve sender profile |
| `instagram_manage_comments` | Read & reply to IG comments |
| `instagram_manage_insights` | Story-reply / engagement signals |
| `pages_messaging` | Send/receive Messenger DMs |
| `pages_read_engagement` | Read Page comments, posts |
| `pages_manage_metadata` | Subscribe / unsubscribe webhook fields |
| `pages_show_list` | Resolve the Page→IG link via `/me/accounts` |

## 4. App Secret (signature verification)

`meta-webhook` verifies every POST against `X-Hub-Signature-256` using HMAC-SHA256
keyed on the integration's `app_secret`. **Without an `app_secret` configured,
the webhook accepts unsigned requests** (back-compat) and the Integration UI
shows an amber banner.

Always paste the App Secret from **Meta App Dashboard → Settings → Basic** into
the `app_secret` field of every Meta integration (WhatsApp, Instagram, Messenger)
that points at the same Meta App.

## 5. Event types stored in `whatsapp_messages.message_type`

| Source | `message_type` value |
|---|---|
| Text DM | `text` |
| Image / video / audio attachment DM | `image` / `video` / `audio` |
| Story reply DM | `story_reply` |
| Instagram comment on a post/reel | `comment` |
| Instagram `@mention` in a story or post | `mention` |

The original Meta IDs (`comment_id`, `media_id`, `story_id`, `mid`) are stored
verbatim in `platform_message_id` so replies can be threaded later.
