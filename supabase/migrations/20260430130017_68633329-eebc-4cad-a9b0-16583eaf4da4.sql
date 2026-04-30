CREATE TABLE IF NOT EXISTS public.webhook_ingress_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  object_type TEXT,
  fields TEXT[] DEFAULT '{}',
  entry_count INTEGER DEFAULT 0,
  messaging_count INTEGER DEFAULT 0,
  signature_verified BOOLEAN DEFAULT false,
  sample JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_ingress_log_created_at ON public.webhook_ingress_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_ingress_log_source ON public.webhook_ingress_log (source);

ALTER TABLE public.webhook_ingress_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'webhook_ingress_log' AND policyname = 'Admins read ingress log'
  ) THEN
    CREATE POLICY "Admins read ingress log"
      ON public.webhook_ingress_log
      FOR SELECT
      TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'owner'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
      );
  END IF;
END $$;