# Google Reviews AI Brain

A single edge function (`google-reviews-brain`) handles every Google-Reviews-related task. Member testimonials remain dormant in pre-opening stage and are never published on the public site.

## Actions

| `action` | Used by | Purpose |
|---|---|---|
| `test_connection` | Settings → Integrations → Google Business "Test connection" button | Verifies branch OAuth credentials by hitting Google Business v4. |
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
Stored per-branch in `integration_settings(type='google_business', provider='google_business', branch_id=…)`:
- `config.account_id`, `config.location_id`, `config.auto_fetch_reviews`
- `credentials.client_id`, `credentials.client_secret`, `credentials.api_key`
- `credentials.refresh_token`, `credentials.access_token`, `credentials.token_expires_at` (managed by the brain)

OAuth refresh: the brain refreshes `access_token` lazily (>2 min before expiry threshold) using `refresh_token` + Google's `oauth2.googleapis.com/token` endpoint, and persists the new token back into `integration_settings.credentials`.

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

**UI:** `Settings → Integrations → Google Business Profile → Auto-discover IDs` opens a Sheet with two cascading dropdowns. Save persists `account_id` + `location_id` into `integration_settings.config`. The manual text fields in the configure drawer remain available as a fallback.
