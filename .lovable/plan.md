# Auto-fetch Google Business Account & Location IDs

## Problem
Today, staff must manually paste `account_id` and `location_id` into the Google Business integration card. Both values are hard to find (buried in Google Business Profile / API Explorer), error-prone, and a frequent reason `fetch_reviews` returns 412.

Google exposes both via authenticated API calls once OAuth is connected, so we can eliminate the manual step entirely.

## Goal
After a branch finishes OAuth (refresh_token saved), staff click **"Discover"** and pick their Business Account and Location from dropdowns. Both IDs auto-save to `integration_settings`. No more copy-paste.

---

## Plan

### 1. Extend `google-reviews-brain` edge function — 2 new actions
Reuse the existing OAuth/token-refresh helper. No new edge function.

- **`list_accounts`** → `GET https://mybusinessaccountinfo.googleapis.com/v1/accounts`
  - Returns `[{ name: "accounts/123…", accountName, type, role }]`
  - Strips `accounts/` prefix → returns clean `account_id` for UI
- **`list_locations`** → `GET https://mybusinessbusinessinformation.googleapis.com/v1/accounts/{account_id}/locations?readMask=name,title,storefrontAddress,storeCode`
  - Returns `[{ location_id, title, address, storeCode }]`
  - Strips `locations/` prefix

Both actions:
- Require `branch_id` in body
- Use existing `getValidAccessToken(branch_id)` helper (lazy refresh)
- Return `{ ok, items }` or `{ ok: false, reason }` with friendly messages for 401 (re-auth needed), 403 (API not enabled), 404 (no accounts)
- Wrapped in `captureEdgeError` like other actions

### 2. UI — `IntegrationSettings.tsx` Google Business config drawer
Replace the two free-text inputs with a guided 2-step picker:

```text
┌─ Google Business Profile (Branch: INCLINE) ────────────┐
│ OAuth Status: ✓ Connected (refresh token on file)     │
│                                                        │
│ [ Discover Account & Location ]  ← new button         │
│                                                        │
│ Business Account:  [ Incline Life Pvt Ltd  ▼ ]        │
│ Location:          [ INCLINE — Hiran Magri ▼ ]        │
│                                                        │
│ ☑ Auto-fetch reviews every 4 hours                     │
│                                                        │
│ [ Test connection ]   [ Save ]                        │
└────────────────────────────────────────────────────────┘
```

Behavior:
- "Discover" disabled until `refresh_token` exists
- Clicking it calls `list_accounts` → populates Account dropdown
- Selecting an account auto-calls `list_locations` for that account → populates Location dropdown
- On Save, persist both raw IDs (without `accounts/` / `locations/` prefixes) to `integration_settings.config`
- Manual override link ("Enter IDs manually") collapses dropdowns back to text inputs as a fallback for edge cases (e.g. service accounts with weird perms)
- Loading skeletons + inline error banner on API failure (with re-auth CTA when 401)

### 3. Telemetry / errors
- All discovery failures logged via `log_error_event` with fingerprint `google_discover_<branch_id>_<status>`
- Toast shows the friendly reason (`"Re-connect Google to refresh permissions"`, `"Enable My Business Business Information API in Google Cloud Console"`, etc.)

### 4. Docs update
- Append a "Auto-discovery" section to `docs/google-reviews-ai-brain.md` listing the two new actions, the Google API endpoints, and the required scopes (`https://www.googleapis.com/auth/business.manage`).

### 5. Non-goals
- No change to OAuth flow itself (still uses existing managed credentials).
- No change to `fetch_reviews` / `classify` / `reply` logic.
- No new tables, no new cron, no new secrets.

---

## Files touched
- `supabase/functions/google-reviews-brain/index.ts` — add 2 action handlers (~80 LOC)
- `src/components/settings/IntegrationSettings.tsx` — swap text inputs for dropdown picker in Google Business drawer (~120 LOC)
- `docs/google-reviews-ai-brain.md` — append Auto-discovery section

## Risk
Low. Pure additive: existing manual-entry path stays as fallback. No schema changes.
