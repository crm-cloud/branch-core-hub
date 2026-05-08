# Google Reviews AI Brain

A single edge function (`google-reviews-brain`) handles every Google-Reviews-related task. Member testimonials remain dormant in pre-opening stage and are never published on the public site.

## Actions

| `action` | Used by | Purpose |
|---|---|---|
| `test_connection` | Settings → Integrations → Google Business "Test connection" button | Verifies branch OAuth credentials by hitting Google Business v4. |
| `oauth_start` | Configure Google Business drawer → "Connect Google" | Starts Google OAuth with `business.manage`, `access_type=offline`, and `prompt=consent` so Google returns a refresh token. |
| `fetch_reviews` | pg_cron (`google-reviews-brain-fetch`, every 4h) + manual "Fetch now" in External Reviews tab | Pulls latest reviews for one branch (or all auto-enabled branches) and upserts into `google_reviews_inbound`. New rows get inline `classify`. |
| `classify` | Inline after fetch, plus per-row "Re-analyse" button | Matches author against members/leads (Dice-bigram ≥0.7), then asks Lovable AI Gateway (Gemini 3 Flash) for `{classification, reasoning, draft_reply}`. Auto-creates a recovery task when classification is `unhappy_member`. |
| `reply` | "Post reply to Google" button | PUT `accounts/{a}/locations/{l}/reviews/{id}/reply`. Stamps `replied_at` + `google_reply_text`. |
| `request_member_review` | Legacy `request-google-review` shim + admin "Send" button on Member Feedback tab | Sends a 4-5★ review request to the member via the canonical `dispatch-communication` funnel. |

## Data flow
```
pg_cron (every 4h)
  → google-reviews-brain (fetch_reviews)
      → for each branch with auto_fetch_reviews=true
          → Google Business v4 reviews.list
          → upsert google_reviews_inbound
          → classify each new row inline
              → Lovable AI Gateway (tool-calling)
              → write classification + draft + match evidence
              → if unhappy_member → INSERT tasks row
```

## Boundaries
- Replies are **never auto-posted**. Staff click "Post reply to Google".
- AI **never accuses competitors**. It surfaces evidence (member match, posting pattern, language) and lets staff decide.
- **No public-website surface** for testimonials in pre-opening stage. `is_approved_for_google` and `consent_for_testimonial` columns persist for a future activation but are not read by marketing pages today.

## Credentials
Stored per-branch in `integration_settings(integration_type='google_business', provider='google_business', branch_id=…)`:
- `config.account_id`, `config.location_id`, `config.auto_fetch_reviews`
- `credentials.client_id`, `credentials.client_secret`, `credentials.api_key`
- `credentials.refresh_token`, `credentials.access_token`, `credentials.token_expires_at` (managed by the brain)

OAuth refresh: the brain refreshes `access_token` lazily (>2 min before expiry threshold) using `refresh_token` + Google's `oauth2.googleapis.com/token` endpoint, and persists the new token back into `integration_settings.credentials`.

OAuth callback URL to add in Google Cloud OAuth Client: `https://<project-ref>.supabase.co/functions/v1/google-reviews-brain`.

## RLS
- `google_reviews_inbound` SELECT/UPDATE: owner/admin OR branch manager OR `staff_branches` member
- DELETE: owner/admin only
- INSERT: service role only (via edge function)

## Auto-discovery (v1.1.0)

Two new actions remove the manual paste of `account_id` / `location_id`:

| Action | Endpoint | Notes |
|---|---|---|
| `list_accounts` | `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts` | Lists every Business Profile account the connected Google login can manage. Strips `accounts/` prefix. |
| `list_locations` | `GET https://mybusinessbusinessinformation.googleapis.com/v1/accounts/{account_id}/locations?readMask=name,title,storefrontAddress,storeCode,websiteUri` | Lists locations under a chosen account. Strips `locations/` prefix. |

**Required scope:** `https://www.googleapis.com/auth/business.manage` (already included in the Google Business OAuth flow).

**APIs to enable in the Google Cloud project** (or 403 SERVICE_DISABLED):
- My Business Account Management API
- My Business Business Information API
- My Business v4 (used by `fetch_reviews` / `reply`)

## Current Google Console/API Library notes (May 2026 audit)

- The OAuth client lives in **Google Auth Platform → Clients** (the legacy "APIs & Services → Credentials" page redirects here). Create a **Web application** client.
- Required **Authorized redirect URI** (exact, no trailing slash): `https://<project-ref>.supabase.co/functions/v1/google-reviews-brain`. Authorized JavaScript origins are optional for this server-side flow.
- Google split Business Profile surfaces across multiple API Library entries. Account discovery is **not** served by the older v4 reviews host.
- Account list endpoint remains `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts`.
- Location list endpoint remains `GET https://mybusinessbusinessinformation.googleapis.com/v1/accounts/{account_id}/locations` and **requires** `readMask`.
- Review list/reply endpoints still use `https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews` and require a verified location.
- API keys alone cannot list accounts/locations. Discovery requires an OAuth refresh token for a Google user that manages the Business Profile.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Error 401: deleted_client` on Google's screen | The OAuth client was deleted in Google Cloud. Create a new Web application client in Google Auth Platform → Clients, save the new Client ID + Secret in **Settings → Integrations → Google Business Profile → Configure**, then click **Connect Google**. |
| `invalid_client` on token exchange | Client ID/Secret pair mismatched. Re-copy both from Google Auth Platform (no spaces) and save again. |
| `redirect_uri_mismatch` | Add the exact callback URL above as an Authorized redirect URI in Google Cloud (no trailing slash). |
| `OAuth not connected` in the app | Save Client ID + Secret, then click **Connect Google** — it stores the refresh token used by `list_accounts` / `list_locations` / `fetch_reviews`. |
| `403 SERVICE_DISABLED` from a Google API | Enable the missing API in Google Cloud → APIs & Services → Library (My Business Account Management API, My Business Business Information API, Google My Business API). |

**UI:** `Settings → Integrations → Google Business Profile → Auto-discover IDs` opens a Sheet with two cascading dropdowns. Save persists `account_id` + `location_id` into `integration_settings.config`. The manual text fields in the configure drawer remain available as a fallback.
