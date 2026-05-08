# Fix Google OAuth — Recreate Deleted Client

Your screenshot shows **Error 401: deleted_client** — the OAuth client you were using has been deleted in Google Cloud. The Client Secret you pasted (`GOCSPX-…`) belongs to that deleted client and will no longer work, so we need to create a fresh one and wire it up.

⚠️ **Security note:** You pasted a client secret directly in chat. Even though this client is deleted, please rotate any secret you ever share in plain text. I will request the new secret via the secure secrets form, never in chat.

---

## Step 1 — Create a new OAuth Client in Google Cloud

In **Google Auth Platform → Clients → Create client**:

- **Application type:** Web application
- **Name:** Incline CRM (or anything you like)

**Authorised JavaScript origins** (add both):
```
https://iyqqpbvnszyrrgerniog.supabase.co
https://id-preview--d9395869-4f5c-4b42-8e1d-4027aacab172.lovable.app
```
(Plus `https://www.theincline.in` and `https://incline.lovable.app` if you want to start the flow from the live app too.)

**Authorised redirect URIs** (this is the critical one — must match EXACTLY):
```
https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/google-reviews-brain
```

Click **Create**. Google will show you the new **Client ID** and **Client Secret** — copy both.

## Step 2 — Make sure required APIs are enabled

In Google Cloud → APIs & Services → Library, enable:
- My Business Account Management API
- My Business Business Information API
- Google My Business API (legacy — needed for reviews list/reply)

## Step 3 — Save credentials in Incline

Two options, pick one:

**A) Per-branch (recommended)** — open Settings → Integrations → Google Business Profile → Configure, paste the new Client ID + Client Secret + API Key into the credentials fields, Save.

**B) Global fallback** — I'll request them as Lovable Cloud secrets (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`) so any branch without per-branch creds inherits them. Tell me if you want this and I'll trigger the secure form.

## Step 4 — Connect & Discover

1. Click **Connect Google** in the Configure drawer → sign in with the Google account that owns the Business Profile → consent.
2. The callback writes a `refresh_token` into `integration_settings`.
3. Click **Auto-discover IDs** → Account ID + Location ID auto-populate.
4. **Test connection** → should show "Connected — N accounts visible".

---

## What I'll change in code (only if needed)

Most likely **no code changes are required** — the redirect URI, OAuth start, callback handler, and discovery are already implemented from the previous round. After you recreate the client and save the new credentials, the flow should just work.

If during testing we hit a new Google API surface change (e.g. account listing moved endpoints again), I'll patch `google-reviews-brain` and re-test with `curl` against the live function.

---

## Confirm before I proceed

Reply with:
1. "Done, created new client" — then I'll walk you through saving credentials and run a live `curl` test against `oauth_start` and `list_accounts` to verify end-to-end.
2. Or "Use global secrets" — and I'll open the secure secrets form for `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`.
