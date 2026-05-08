-- Clear stale Google Business OAuth tokens so the next "Connect Google" forces a clean consent
-- after the user creates a fresh OAuth client in Google Cloud.
UPDATE public.integration_settings
SET credentials = (credentials::jsonb
                   - 'access_token'
                   - 'refresh_token'
                   - 'token_expires_at'
                   - 'scope')::jsonb,
    updated_at = now()
WHERE integration_type = 'google_business'
  AND provider = 'google_business';