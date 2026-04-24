-- Add missing webhook tracking columns to payment_transactions
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS http_status integer,
  ADD COLUMN IF NOT EXISTS signature_verified boolean,
  ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_received_at
  ON public.payment_transactions (received_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_source
  ON public.payment_transactions (source);

-- Add template_id to member_fitness_plans for usage tracking
ALTER TABLE public.member_fitness_plans
  ADD COLUMN IF NOT EXISTS template_id uuid;

CREATE INDEX IF NOT EXISTS idx_member_fitness_plans_template_id
  ON public.member_fitness_plans (template_id);