-- Cleanup stale empty Instagram integration row
DELETE FROM public.integration_settings 
WHERE id = '421a4088-6426-4555-a96c-ecb43fd442e3' 
  AND integration_type = 'instagram'
  AND (config IS NULL OR config = '{}'::jsonb OR config->>'page_id' IS NULL);

-- Webhook failures table for diagnostics
CREATE TABLE IF NOT EXISTS public.webhook_failures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  object_type TEXT,
  reason TEXT NOT NULL,
  signature_present BOOLEAN NOT NULL DEFAULT false,
  branch_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_failures_created ON public.webhook_failures(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_failures_source ON public.webhook_failures(source);

ALTER TABLE public.webhook_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook failures"
ON public.webhook_failures FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Service role can insert webhook failures"
ON public.webhook_failures FOR INSERT
TO service_role
WITH CHECK (true);