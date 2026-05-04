-- v1.0.0 — Public self-registration: OTP + onboarding signatures + storage

CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_otp_verif_phone_expires
  ON public.otp_verifications (phone, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_verif_created_at
  ON public.otp_verifications (created_at);

CREATE TABLE IF NOT EXISTS public.member_onboarding_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  signature_path text NOT NULL,
  waiver_pdf_path text NOT NULL,
  par_q jsonb NOT NULL DEFAULT '{}'::jsonb,
  consents jsonb NOT NULL DEFAULT '{}'::jsonb,
  signer_ip inet,
  signer_user_agent text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id)
);
ALTER TABLE public.member_onboarding_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Member reads own onboarding signature"
  ON public.member_onboarding_signatures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_onboarding_signatures.member_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff+ reads branch onboarding signatures"
  ON public.member_onboarding_signatures
  FOR SELECT
  TO authenticated
  USING (public.has_capability(auth.uid(), 'view_member_documents'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('member-onboarding', 'member-onboarding', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Member reads own onboarding files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'member-onboarding'
    AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid()
        AND (storage.foldername(name))[1] = m.id::text
    )
  );

CREATE POLICY "Staff+ reads branch onboarding files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'member-onboarding'
    AND public.has_capability(auth.uid(), 'view_member_documents')
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'members'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.members';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.purge_expired_otp_verifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.otp_verifications
  WHERE created_at < now() - interval '24 hours';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge_expired_otp_verifications_daily') THEN
    PERFORM cron.schedule(
      'purge_expired_otp_verifications_daily',
      '17 3 * * *',
      $cron$SELECT public.purge_expired_otp_verifications();$cron$
    );
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;