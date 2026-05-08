## Findings

- The app is still generating the Google consent URL with this saved Client ID: `401987773801-go8vch1cm698tbi0elbtbhk4sar4iig1.apps.googleusercontent.com`.
- The screenshot error mentions a different Client ID: `122775204755-60j9ml5129nj89b837q2i5r2s0jk6ugg.apps.googleusercontent.com`.
- The current saved integration has **no refresh token**, so account/location discovery cannot run yet.
- The redirect URI wiring is correct and must match exactly:
  `https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/google-reviews-brain`
- The pasted client secret is exposed in chat and should be rotated/replaced in Google Cloud.

## Plan

1. **Update the saved Google Business credentials**
   - Replace the stale/deleted OAuth credentials in `integration_settings` for the branch with the new Web application Client ID and the rotated/new Client Secret.
   - Keep existing Google config fields where possible, but clear stale OAuth tokens so the app forces a clean consent flow.

2. **Harden the Google OAuth UI**
   - Add a visible diagnostic line in the Configure drawer showing which Client ID is currently saved, masked enough to confirm it matches Google Cloud.
   - Add a warning/help state for `deleted_client`: “The saved Client ID was deleted in Google Cloud. Create/save a new Web application OAuth client, then reconnect.”
   - Clarify that JavaScript origins are optional for this server-side OAuth flow, while the Authorized redirect URI is mandatory.

3. **Improve backend error handling**
   - Update `google-reviews-brain` to detect Google OAuth errors such as `deleted_client`, `invalid_client`, and `redirect_uri_mismatch` and return specific setup guidance instead of generic failures.
   - Add a small debug payload from `oauth_start` with the current redirect URI and masked Client ID so curl tests are easier.

4. **Update setup guide/docs**
   - Update the in-app guide and `docs/google-reviews-ai-brain.md` with the current Google Console navigation:
     - Google Auth Platform → Clients → Web application
     - Authorized redirect URI: `https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/google-reviews-brain`
     - APIs: My Business Account Management API, My Business Business Information API, Google My Business API
   - Add a troubleshooting section for `deleted_client`, `invalid_client`, and missing refresh token.

5. **Run live verification after changes**
   - Curl `oauth_start` and confirm the generated URL uses the newly saved Client ID and exact redirect URI.
   - After you complete the Google consent screen, curl `list_accounts` to confirm Google returns the Business Profile account list.