-- Ensure global (branch-less) integrations are unique per (integration_type, provider)
CREATE UNIQUE INDEX IF NOT EXISTS integration_settings_global_unique
  ON public.integration_settings (integration_type, provider)
  WHERE branch_id IS NULL;

-- Seed Howbody body scanner row (config public, credentials filled via UI)
INSERT INTO public.integration_settings (branch_id, integration_type, provider, is_active, config, credentials)
VALUES (
  NULL,
  'body_scanner',
  'howbody',
  true,
  jsonb_build_object(
    'base_url', 'https://prodapi.howbodyfit.com/howbody-admin',
    'username', 'TechnicalSupport2026430'
  ),
  '{}'::jsonb
)
ON CONFLICT (integration_type, provider) WHERE branch_id IS NULL DO NOTHING;