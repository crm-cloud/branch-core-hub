-- Add lead nurture config to organization_settings
ALTER TABLE public.organization_settings
ADD COLUMN IF NOT EXISTS lead_nurture_config jsonb DEFAULT '{"enabled": true, "delay_hours": 4, "max_retries": 2}'::jsonb;

-- Add nurture retry counter to whatsapp_chat_settings
ALTER TABLE public.whatsapp_chat_settings
ADD COLUMN IF NOT EXISTS nurture_retry_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_nurture_at timestamptz;