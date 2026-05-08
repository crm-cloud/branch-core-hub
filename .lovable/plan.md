# Fix Google Business Configure drawer & "find my IDs" flow

## What's broken

1. **"Unsupported type: google_business"** toast on the Configure drawer comes from `Test connection` calling `test-integration` edge fn — that function's `switch (type)` only handles sms/email/whatsapp/instagram/messenger. Google Business falls through to the default `Unsupported type` branch.
2. **Auto-discover save will silently fail** — `GoogleBusinessDiscovery.tsx` (lines 99–100) filters `integration_settings` by `.eq('type', 'google_business')` and `.eq('provider', 'google_business')`, but the actual columns are `integration_type` and (for this row) `integration_type` is the discriminator. Same bug pattern we just fixed in the edge function.
3. Users don't realise the **Auto-discover IDs** button on the Google Business card is the answer to "how do I find my Account ID / Location ID" — there's no inline hint inside the Configure drawer.

## Plan

### A. Route Google Business test through the AI brain (1 edge fn rule)
- In `supabase/functions/test-integration/index.ts`, add a `case "google_business"` that internally invokes `google-reviews-brain` with `{ action: "list_accounts", branch_id }` and returns `{ success: true }` if at least one account comes back, otherwise surfaces the brain's error verbatim (`OAuth not connected`, `Token expired`, `My Business API not enabled`, etc.).
- Keeps the "one edge function for Google reviews" rule from the earlier brief — `test-integration` just delegates.

### B. Fix the Discovery save bug
- In `src/components/settings/GoogleBusinessDiscovery.tsx` `handleSave`, change `.eq('type', 'google_business')` → `.eq('integration_type', 'google_business')` and drop the redundant `.eq('provider', ...)` (or keep it if the row uses provider too — verified row uses `integration_type`).

### C. Make "find your IDs" obvious inside the Configure drawer
- In the Configure drawer (`IntegrationSettings.tsx`, Google Business branch around line 1158+), above the **Account ID** and **Location ID** inputs add a soft indigo info card:
  > "Don't know your IDs? Close this and click **Auto-discover IDs** on the Google Business card — we'll fetch them from your connected Google account."
- Add a secondary `Auto-discover` link-button inside the drawer that closes the Configure sheet and opens `GoogleBusinessDiscovery` directly, so the user doesn't have to back out manually.

### D. Audit notes (no code change, just confirm in plan)
- `integration_settings` row for Google Business is **branch-scoped** (already enforced by `isBranchSpecific` flag at line 1159) — Auto-discover already passes `branchId`. ✓
- `google-reviews-brain` already reads creds via `integration_type='google_business'` after the previous fix. ✓
- OAuth Client ID / Secret / API Key live in `credentials` JSON; `account_id` / `location_id` live in `config` JSON. Discovery writes to `config` only — correct. ✓

## Files touched
- `supabase/functions/test-integration/index.ts` — add `google_business` case delegating to brain
- `src/components/settings/GoogleBusinessDiscovery.tsx` — fix column name in save query
- `src/components/settings/IntegrationSettings.tsx` — inline hint + "Auto-discover" shortcut inside Configure drawer

## Outcome
- `Test connection` returns a real status ("Connected — 2 accounts visible" / "Token expired, reconnect OAuth") instead of the misleading "Unsupported type".
- Auto-discover actually persists the picked Account ID + Location ID.
- Anyone opening the Configure drawer immediately sees how to fetch IDs without leaving the screen or hunting in Google Cloud Console.
