-- Contract digital signing flow

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS signature_status TEXT DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS signature_requested_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS signed_document_url TEXT,
  ADD COLUMN IF NOT EXISTS agreement_hash TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contracts_signature_status_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_signature_status_check
      CHECK (signature_status IN ('not_sent', 'sent', 'viewed', 'signed', 'expired', 'revoked'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.contract_signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'signed', 'expired', 'revoked')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  signer_name TEXT,
  signer_contact TEXT
);

CREATE INDEX IF NOT EXISTS idx_contract_signature_requests_contract_id
  ON public.contract_signature_requests(contract_id);

CREATE INDEX IF NOT EXISTS idx_contract_signature_requests_status
  ON public.contract_signature_requests(status);

CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.contract_signature_requests(id) ON DELETE SET NULL,
  signed_name TEXT NOT NULL,
  signer_contact TEXT,
  signature_text TEXT,
  ip_address TEXT,
  user_agent TEXT,
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract_id
  ON public.contract_signatures(contract_id);

ALTER TABLE public.contract_signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contract_signature_requests'
      AND policyname = 'Management read contract signature requests'
  ) THEN
    CREATE POLICY "Management read contract signature requests"
      ON public.contract_signature_requests
      FOR SELECT
      USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contract_signatures'
      AND policyname = 'Management read contract signatures'
  ) THEN
    CREATE POLICY "Management read contract signatures"
      ON public.contract_signatures
      FOR SELECT
      USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]));
  END IF;
END $$;
