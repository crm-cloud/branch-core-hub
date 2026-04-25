-- ============================================================
-- Contract e-signature schema
-- ============================================================

-- 1) Add columns the edge function already writes to
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS signature_status text NOT NULL DEFAULT 'not_sent'
    CHECK (signature_status IN ('not_sent','sent','viewed','signed','expired','revoked')),
  ADD COLUMN IF NOT EXISTS signature_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_pdf_url text,
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_signature_status ON public.contracts (signature_status);

-- 2) Signature requests (one per signing link)
CREATE TABLE IF NOT EXISTS public.contract_signature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','viewed','signed','expired','revoked')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  signer_name text,
  signer_contact text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_csr_contract ON public.contract_signature_requests (contract_id);
CREATE INDEX IF NOT EXISTS idx_csr_token ON public.contract_signature_requests (token_hash);

ALTER TABLE public.contract_signature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_csr" ON public.contract_signature_requests
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]));

-- 3) Signatures (one per signed event)
CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.contract_signature_requests(id) ON DELETE SET NULL,
  signed_name text NOT NULL,
  signer_contact text,
  signature_text text NOT NULL,
  ip_address text,
  user_agent text,
  signed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cs_contract ON public.contract_signatures (contract_id);

ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_view_signatures" ON public.contract_signatures
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]));

CREATE POLICY "admin_insert_signatures" ON public.contract_signatures
  FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]));