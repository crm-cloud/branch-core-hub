## Problem

The **“Google rate limit hit — try again in a minute”** message happens because Auto-discover calls Google’s Business Account Management API. New Google Cloud projects often have a very low quota, so the app gets blocked before it can discover the business/location IDs.

You already shared these URLs:

```text
https://business.google.com/n/12130706210459521632/searchprofile
https://business.google.com/n/12130706210459521632/profile?fid=16924117606749867165
```

So we can bypass Auto-discover entirely.

## IDs to save

```text
Account ID: 12130706210459521632
Location/FID: 16924117606749867165
```

## Plan

1. **Save the IDs directly**
   - Update the existing Google Business integration credentials for the INCLINE branch.
   - Preserve the existing OAuth access/refresh tokens.
   - Add:
     - `account_id = 12130706210459521632`
     - `location_id = 16924117606749867165`

2. **Stop relying on Auto-discover for this branch**
   - Once these IDs are saved, the app should skip the rate-limited discovery step.
   - Review fetch/reply actions should use the saved IDs directly.

3. **Verify the connection**
   - Call the Google Reviews backend function with `test_connection`.
   - Call `fetch_reviews` to confirm reviews return correctly.
   - If Google rejects the `fid` value for the Reviews API, inspect the API error and adjust the stored location identifier accordingly.

4. **Add a manual fallback in the Configure UI**
   - Add a “Manual entry” section in the Google Business configure drawer.
   - Fields:
     - Account ID
     - Location/FID
   - Include helper text showing the URL pattern:

   ```text
   business.google.com/n/<ACCOUNT_ID>/profile?fid=<LOCATION_ID>
   ```

   - Keep Auto-discover as optional, with a note that it can fail with Google 429 rate limits.

## Expected result

You will no longer need Auto-discover for this branch, and the Google Reviews integration can fetch/reply using the saved Business Profile IDs.