
ALTER TABLE public.whatsapp_chat_settings
ADD COLUMN IF NOT EXISTS partial_lead_data JSONB DEFAULT NULL;

ALTER TABLE public.organization_settings
ADD COLUMN IF NOT EXISTS gst_rates JSONB DEFAULT '[5, 12, 18, 28]'::jsonb;
