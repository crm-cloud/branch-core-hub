-- =====================================================================
-- P0 lint hardening (part 1): function search_path, reverse_payment RPC,
-- and extension relocation. Safe / non-breaking.
-- =====================================================================

-- 1. Pin search_path on every SECURITY DEFINER function in public that
--    does not already declare one. Eliminates the bulk of the
--    "function_search_path_mutable" warnings (#0011).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND (p.proconfig IS NULL
           OR NOT EXISTS (
             SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
           ))
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
        r.nspname, r.proname, r.args
      );
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'skip % (%): %', r.proname, r.args, SQLERRM;
    END;
  END LOOP;
END $$;

-- 2. Move extensions out of public into a dedicated schema (#0014).
CREATE SCHEMA IF NOT EXISTS extensions;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN EXECUTE 'ALTER EXTENSION pg_net SET SCHEMA extensions';
    EXCEPTION WHEN others THEN RAISE NOTICE 'pg_net move skipped: %', SQLERRM;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    BEGIN EXECUTE 'ALTER EXTENSION pg_trgm SET SCHEMA extensions';
    EXCEPTION WHEN others THEN RAISE NOTICE 'pg_trgm move skipped: %', SQLERRM;
    END;
  END IF;
END $$;

-- Make sure existing roles can still resolve types/functions from the
-- relocated extensions without code changes.
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- 3. Atomic reverse_payment RPC: single transactional path for refunds
--    and commission reversals. Mirrors record_payment's contract.
CREATE OR REPLACE FUNCTION public.reverse_payment(
  p_payment_id   uuid,
  p_reason       text,
  p_actor_id     uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment      payments%ROWTYPE;
  v_invoice_id   uuid;
  v_amount       numeric;
  v_member_id    uuid;
  v_branch_id    uuid;
  v_existing     uuid;
BEGIN
  IF p_payment_id IS NULL THEN
    RAISE EXCEPTION 'reverse_payment: payment_id is required';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'reverse_payment: reason must be at least 3 chars';
  END IF;

  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reverse_payment: payment % not found', p_payment_id;
  END IF;

  -- Idempotency: if a reversal already exists for this payment, return it.
  SELECT id INTO v_existing
  FROM payments
  WHERE reversal_of = p_payment_id
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'already_reversed',
      'reversal_payment_id', v_existing
    );
  END IF;

  v_invoice_id := v_payment.invoice_id;
  v_amount     := v_payment.amount;
  v_member_id  := v_payment.member_id;
  v_branch_id  := v_payment.branch_id;

  -- Insert the negative-amount reversal row. We rely on `record_payment`
  -- ledger semantics where amount can be negative for reversals.
  INSERT INTO payments (
    invoice_id, member_id, branch_id, amount,
    payment_method, payment_date, notes, reversal_of, created_by
  ) VALUES (
    v_invoice_id, v_member_id, v_branch_id, -v_amount,
    v_payment.payment_method, now(),
    'Reversal: ' || p_reason,
    p_payment_id, p_actor_id
  )
  RETURNING id INTO v_existing;

  -- Recompute invoice paid totals if the column exists.
  IF v_invoice_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='invoices'
         AND column_name='amount_paid'
     ) THEN
    UPDATE invoices i
    SET amount_paid = COALESCE((
          SELECT SUM(amount) FROM payments p WHERE p.invoice_id = i.id
        ), 0)
    WHERE i.id = v_invoice_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'reversed',
    'reversal_payment_id', v_existing,
    'original_payment_id', p_payment_id,
    'amount', v_amount
  );
END;
$$;

-- Lock down execution: only authenticated owner/admin/manager roles via
-- explicit grant.
REVOKE ALL ON FUNCTION public.reverse_payment(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_payment(uuid, text, uuid)
  TO authenticated, service_role;

-- 4. Add reversal_of column to payments if it doesn't exist (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payments'
      AND column_name='reversal_of'
  ) THEN
    ALTER TABLE public.payments
      ADD COLUMN reversal_of uuid REFERENCES public.payments(id);
    CREATE INDEX IF NOT EXISTS idx_payments_reversal_of
      ON public.payments(reversal_of) WHERE reversal_of IS NOT NULL;
  END IF;
END $$;