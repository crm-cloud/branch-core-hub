CREATE TABLE IF NOT EXISTS public.webhook_processing_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  object_type TEXT,
  event_kind TEXT,
  platform_message_id TEXT,
  status TEXT NOT NULL,
  reason TEXT,
  meta_error_code INTEGER,
  meta_error_subcode INTEGER,
  meta_error_message TEXT,
  sample JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_processing_log_created_at ON public.webhook_processing_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_processing_log_status ON public.webhook_processing_log (status);
CREATE INDEX IF NOT EXISTS idx_webhook_processing_log_mid ON public.webhook_processing_log (platform_message_id);

ALTER TABLE public.webhook_processing_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='webhook_processing_log' AND policyname='Admins read processing log'
  ) THEN
    CREATE POLICY "Admins read processing log"
      ON public.webhook_processing_log
      FOR SELECT TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'owner'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
      );
  END IF;
END $$;