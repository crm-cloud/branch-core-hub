-- reconcile_payments_daily used 'success'::payment_status but the enum only
-- contains pending|completed|failed|refunded. Replace with 'completed'.
CREATE OR REPLACE FUNCTION public.reconcile_payments_daily()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice_drift int := 0;
  v_wallet_drift int := 0;
  v_run_date date := (now() AT TIME ZONE 'Asia/Kolkata')::date - 1;
BEGIN
  -- Invoice amount_paid drift
  WITH agg AS (
    SELECT i.id, i.branch_id, i.amount_paid AS recorded,
           COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'::payment_status), 0) AS actual
      FROM public.invoices i
      LEFT JOIN public.payments p ON p.invoice_id = i.id
     WHERE i.created_at::date >= v_run_date - 7
     GROUP BY i.id, i.branch_id, i.amount_paid
  ), drift AS (
    INSERT INTO public.reconciliation_findings
      (run_date, kind, severity, branch_id, reference_type, reference_id, details)
    SELECT v_run_date, 'invoice_drift', 'warn', branch_id, 'invoice', id,
           jsonb_build_object('recorded', recorded, 'actual', actual,
                              'delta', actual - recorded)
      FROM agg WHERE ABS(actual - recorded) > 0.01
    RETURNING 1
  )
  SELECT count(*) INTO v_invoice_drift FROM drift;

  -- Wallet balance drift
  WITH agg AS (
    SELECT w.id, w.member_id, w.balance AS recorded,
           COALESCE(SUM(CASE WHEN wt.txn_type IN ('credit','refund')
                             THEN wt.amount
                             ELSE -wt.amount END), 0) AS actual
      FROM public.wallets w
      LEFT JOIN public.wallet_transactions wt ON wt.wallet_id = w.id
     GROUP BY w.id, w.member_id, w.balance
  ), drift AS (
    INSERT INTO public.reconciliation_findings
      (run_date, kind, severity, reference_type, reference_id, details)
    SELECT v_run_date, 'wallet_drift', 'warn', 'wallet', id,
           jsonb_build_object('recorded', recorded, 'actual', actual,
                              'delta', actual - recorded, 'member_id', member_id)
      FROM agg WHERE ABS(actual - recorded) > 0.01
    RETURNING 1
  )
  SELECT count(*) INTO v_wallet_drift FROM drift;

  RETURN jsonb_build_object(
    'run_date', v_run_date,
    'invoice_drift', v_invoice_drift,
    'wallet_drift', v_wallet_drift
  );
END;
$function$;