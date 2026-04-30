## TL;DR — which secret to use

You have **two different secrets** because the Meta dashboard splits them by product:

| Secret | Value (prefix) | Where Meta uses it |
|---|---|---|
| **Basic App Secret** (Settings → Basic) | `4eb1bc06…` | Signs webhooks for **WhatsApp** + **Page (Messenger)** products. Used in `appsecret_proof` for `graph.facebook.com` calls (your `EAA…` WhatsApp token). |
| **Instagram App Secret** (Instagram product → API setup with Instagram login) | `e40219c5…` | Signs webhooks for the **Instagram product** when you use **Instagram Login** (your `IGAA…` token, `graph.instagram.com` host). |

Right now the CRM has the **Basic** secret saved on the Instagram integration. That's wrong for the IGAA flow — Meta is signing IG webhooks with the **Instagram** app secret, so even when delivery starts, every payload would be rejected as "Invalid signature".

**Rule for our app:**
- Instagram integration with `IGAA…` token → save the **Instagram App Secret** (`e40219c5…`)
- WhatsApp integration with `EAA…` token → save the **Basic App Secret** (`4eb1bc…`)
- Messenger / Instagram-via-Facebook (EAA) → save the **Basic App Secret**

## Why you see zero inbound messages

Audit results:
- `meta-webhook` edge function logs: **empty** (Meta has never called it).
- `whatsapp-webhook` logs: **empty** for IG traffic.
- IG integration row exists, is_active=true, IGAA token saved, verify token saved.
- A stale empty `instagram` row exists (`421a4088…`) — harmless but confusing.

So the problem is **upstream of our code**: Meta is not delivering Instagram events to our URL. Three things must all be true at Meta's end and only one is currently confirmed:

1. **Instagram product → Webhooks → Callback URL** = `https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/meta-webhook` with verify token `4fe45162-9f13-415d-989b-e77c1b1f1d1c` — and **Verify and Save** must show green.
2. **Subscribed fields** on the Instagram product must include at minimum `messages`, `messaging_postbacks`, `comments`, `mentions`. The previous `meta-subscribe` call subscribed the IG **account** to the app, but the **app** itself must also be subscribed to those **fields** at the product level.
3. The IG account must be in **Live mode** OR added as a **Tester / Instagram Tester** under App Roles. In Dev mode, only roles/testers trigger webhooks. Your personal IG account that sent "hi" most likely is not a tester → Meta silently drops the event.

This third point is almost certainly the root cause given zero deliveries.

## Plan — what I will change in code

### A. Fix the secret model in the UI
1. In `IntegrationSettings.tsx`, when the integration is the **Instagram Business Login (IGAA)** card, relabel the App Secret field to "**Instagram App Secret** (Meta → Instagram product → API setup with Instagram login)" with help text explaining it is a *different* value from the Basic App Secret.
2. For the **Instagram via Facebook (EAA)** card and WhatsApp card, keep the label "**App Secret** (Settings → Basic)".
3. Add an inline warning if the saved IGAA secret does **not** match a `^[a-f0-9]{32}$` shape, or if the same secret is reused across both Instagram cards (likely wrong).

### B. Auto-overwrite the wrong secret
Provide a one-click "Use Instagram App Secret" prompt on the IGAA card. After you paste `e40219c54f7d918123bdbdacc3a4ce64` and Save, the webhook signature check will start passing.

### C. Add a diagnostics endpoint
New edge function `meta-diagnose` that:
- Calls `GET /me?fields=id,username,account_type` on `graph.instagram.com` with the IGAA token → confirms token validity + scopes.
- Calls `GET /{ig-id}/subscribed_apps` → confirms the app is subscribed to the IG account.
- Returns a checklist: token OK / subscribed OK / verify token saved / app secret format OK.

A "Run Diagnostics" button on the IGAA card surfaces the result inline.

### D. Webhook hardening
- In `meta-webhook`, log a clear one-line summary on every POST: object type, entries count, signature header present, signature accepted/rejected, which secret matched. This makes future "no message arrived" debugging instant.
- When signature is rejected, store one row in a new lightweight `webhook_failures` table (object, ts, reason, header present) so we can show "Meta tried X times but signatures failed — your saved app secret is wrong" in the UI.

### E. Clean up stale rows
Delete the empty `instagram` integration row `421a4088-6426-4555-a96c-ecb43fd442e3` (no token, no config) so the lookup logic has only one IG candidate.

## What you need to do at Meta Dashboard (cannot be automated)

1. **App Dashboard → Instagram product → API setup with Instagram login → 3. Configure webhooks**
   - Callback URL: `https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/meta-webhook`
   - Verify token: `4fe45162-9f13-415d-989b-e77c1b1f1d1c`
   - Click **Verify and save**.
   - Subscribe to fields: `messages`, `messaging_postbacks`, `messaging_seen`, `comments`, `mentions`, `message_reactions`.

2. **App Dashboard → App Roles → Roles** (or → **Instagram Testers**)
   - Add the personal IG handle you DM'd from (e.g. `@your_personal`) as an **Instagram Tester**.
   - Open Instagram on that personal account → Settings → Apps and Websites → Tester Invites → **Accept**.
   - Until this is done, Meta drops every webhook in dev mode and you will see **nothing** in our logs no matter what we change in code.

3. **App Dashboard → Settings → Basic**
   - Confirm the **App Secret** shown matches `4eb1bc06a72ff449bd0336e5dc8f979a` (this is what you save on the WhatsApp + Instagram-via-FB cards).

4. After accepting the tester invite, send a fresh "hi" DM. Within 2 seconds the meta-webhook logs will show one POST and the message will land in the CRM inbox.

## Acceptance criteria

- IGAA card UI clearly distinguishes Instagram App Secret from Basic App Secret.
- After you paste the IG secret, "Run Diagnostics" returns all green.
- After you accept the IG tester invite, sending a DM produces a row in `whatsapp_messages` within 5 seconds and is visible in the chat UI.
- meta-webhook logs show: `signature accepted, secret=instagram, object=instagram, entries=1`.

## Files to change

- `supabase/functions/meta-webhook/index.ts` — richer logging, failure recording.
- `supabase/functions/meta-diagnose/index.ts` — **new**.
- `src/components/settings/IntegrationSettings.tsx` — relabel field per integration type, add diagnostics button + warning banner.
- Migration — create `webhook_failures` table; delete stale empty IG row.
