-- Add Meta Ads attribution columns to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ad_id text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS campaign_name text;

-- Index for campaign analytics
CREATE INDEX IF NOT EXISTS idx_leads_campaign_name ON public.leads(campaign_name) WHERE campaign_name IS NOT NULL;

-- Add internal notes support to whatsapp_messages
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS is_internal_note boolean NOT NULL DEFAULT false;