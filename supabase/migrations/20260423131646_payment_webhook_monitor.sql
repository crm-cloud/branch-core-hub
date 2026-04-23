-- Task #17: Payment webhook monitor — extend payment_transactions with delivery metadata

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS signature_verified BOOLEAN,
  ADD COLUMN IF NOT EXISTS http_status INTEGER,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'order',
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

COMMENT ON COLUMN public.payment_transactions.signature_verified IS 'true=verified, false=invalid, null=not checked (no secret configured)';
COMMENT ON COLUMN public.payment_transactions.http_status IS 'HTTP response status the webhook handler returned to the gateway';
COMMENT ON COLUMN public.payment_transactions.error_message IS 'Last error/diagnostic for this transaction (webhook processing or other)';
COMMENT ON COLUMN public.payment_transactions.event_type IS 'Webhook event type (e.g. payment.captured, payment_link.paid, COMPLETED)';
COMMENT ON COLUMN public.payment_transactions.source IS 'Origin of this row: order (created by app) | webhook (created by webhook delivery)';
COMMENT ON COLUMN public.payment_transactions.received_at IS 'When the most recent webhook for this row was received';

CREATE INDEX IF NOT EXISTS idx_payment_transactions_received_at ON public.payment_transactions (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway_received ON public.payment_transactions (gateway, received_at DESC);

-- Tighten RLS: branch-scoped read access for managers/staff (owners/admins keep global access via manages_branch())
DROP POLICY IF EXISTS "Staff can view payment transactions" ON public.payment_transactions;
CREATE POLICY "Branch-scoped view payment transactions"
ON public.payment_transactions FOR SELECT
USING (
  public.manages_branch(auth.uid(), branch_id)
  OR EXISTS (
    SELECT 1 FROM public.staff_branches sb
    WHERE sb.user_id = auth.uid() AND sb.branch_id = payment_transactions.branch_id
  )
);

-- Enable realtime for live monitoring (idempotent)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_transactions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
