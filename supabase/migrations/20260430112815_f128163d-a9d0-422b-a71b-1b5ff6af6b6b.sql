CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('meta_signed', 'user_manual')),
  email TEXT,
  external_user_id TEXT,
  confirmation_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','rejected')),
  payload JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ddr_status ON public.data_deletion_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ddr_email ON public.data_deletion_requests(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ddr_external ON public.data_deletion_requests(external_user_id) WHERE external_user_id IS NOT NULL;

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view deletion requests" ON public.data_deletion_requests;
CREATE POLICY "Admins view deletion requests"
ON public.data_deletion_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Admins manage deletion requests" ON public.data_deletion_requests;
CREATE POLICY "Admins manage deletion requests"
ON public.data_deletion_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  )
);