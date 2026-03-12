ALTER TABLE public.organization_settings 
ADD COLUMN IF NOT EXISTS webhook_slug uuid DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS session_timeout_hours integer DEFAULT 8;

CREATE INDEX IF NOT EXISTS idx_org_settings_webhook_slug ON public.organization_settings(webhook_slug);