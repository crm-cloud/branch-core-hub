ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS response_body jsonb;

UPDATE public.payment_transactions
SET received_at = created_at
WHERE received_at IS NULL
  AND source IS NULL;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY member_id, total_amount, date_trunc('minute', created_at)
      ORDER BY created_at DESC
    ) AS rn
  FROM public.invoices
  WHERE status IN ('pending', 'partial')
    AND member_id IS NOT NULL
    AND amount_paid = 0
),
to_cancel AS (
  SELECT id FROM ranked WHERE rn > 1
)
UPDATE public.invoices
SET status = 'cancelled',
    notes = COALESCE(notes, '') || ' [auto-cancelled duplicate during purchase-flow cleanup]',
    updated_at = now()
WHERE id IN (SELECT id FROM to_cancel);