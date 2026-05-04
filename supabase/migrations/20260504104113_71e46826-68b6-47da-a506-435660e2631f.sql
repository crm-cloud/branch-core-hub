
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS campaign_type text NOT NULL DEFAULT 'announcement',
  ADD COLUMN IF NOT EXISTS event_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Helpful index for filtering by type in the campaigns hub.
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON public.campaigns (campaign_type);
