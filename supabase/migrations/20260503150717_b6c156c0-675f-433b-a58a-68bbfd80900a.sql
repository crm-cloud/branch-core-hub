CREATE OR REPLACE FUNCTION public.cancel_membership(
  p_membership_id   uuid,
  p_reason          text,
  p_refund_amount   numeric DEFAULT 0,
  p_refund_method   text    DEFAULT 'cash',
  p_idempotency_key text    DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_key           text := COALESCE(p_idempotency_key, gen_random_uuid()::text);
  v_membership    record;
  v_refund_inv_id uuid;
  v_payment_id    uuid;
  v_existing      jsonb;
  v_voided_count  int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.has_capability(v_uid, 'cancel_membership') THEN
    RAISE EXCEPTION 'permission denied: cancel_membership';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'cancellation reason required';
  END IF;

  SELECT result INTO v_existing
  FROM public.membership_action_attempts
  WHERE idempotency_key = v_key AND status = 'succeeded';
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO public.membership_action_attempts(idempotency_key,user_id,membership_id,action)
  VALUES (v_key, v_uid, p_membership_id, 'cancel')
  ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT * INTO v_membership FROM public.memberships WHERE id = p_membership_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'membership % not found', p_membership_id; END IF;
  IF v_membership.status = 'cancelled' THEN
    RAISE EXCEPTION 'membership already cancelled';
  END IF;

  UPDATE public.memberships
     SET status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = v_uid,
         cancellation_reason = p_reason,
         refund_amount = p_refund_amount
   WHERE id = p_membership_id;

  WITH voided AS (
    UPDATE public.invoices i
       SET status = 'cancelled'::invoice_status,
           notes  = COALESCE(i.notes,'') ||
                    E'\nAuto-cancelled with membership on ' || now()::date ||
                    '. Reason: ' || p_reason
     WHERE i.id IN (
       SELECT ii.invoice_id
       FROM public.invoice_items ii
       WHERE ii.reference_id = p_membership_id
         AND ii.reference_type = 'membership'
     )
       AND i.status::text IN ('pending','partial','overdue')
       AND COALESCE(i.amount_paid,0) = 0
    RETURNING 1
  )
  SELECT count(*) INTO v_voided_count FROM voided;

  IF p_refund_amount > 0 THEN
    INSERT INTO public.invoices(
      branch_id, member_id, invoice_number,
      subtotal, total_amount, status, notes,
      refund_amount, refund_reason, refunded_at, refunded_by
    ) VALUES (
      v_membership.branch_id, v_membership.member_id, NULL,
      -p_refund_amount, -p_refund_amount, 'refunded',
      'Refund for cancelled membership. Reason: ' || p_reason,
      p_refund_amount, p_reason, now(), v_uid
    )
    RETURNING id INTO v_refund_inv_id;

    INSERT INTO public.invoice_items(
      invoice_id, description, quantity, unit_price, total_amount,
      reference_type, reference_id
    ) VALUES (
      v_refund_inv_id,
      'Refund - membership cancellation',
      1, -p_refund_amount, -p_refund_amount,
      'membership_refund', p_membership_id
    );

    INSERT INTO public.payments(
      branch_id, member_id, invoice_id, amount, payment_method, status, payment_date
    ) VALUES (
      v_membership.branch_id, v_membership.member_id, v_refund_inv_id,
      -p_refund_amount, p_refund_method::payment_method, 'completed', now()
    )
    RETURNING id INTO v_payment_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE member_id = v_membership.member_id
      AND status = 'active'
      AND id <> p_membership_id
  ) THEN
    UPDATE public.members SET status = 'inactive' WHERE id = v_membership.member_id;
  END IF;

  BEGIN
    PERFORM public.transition_member_lifecycle(v_membership.member_id, 'suspended', p_reason);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  v_existing := jsonb_build_object(
    'membership_id', p_membership_id,
    'refund_invoice_id', v_refund_inv_id,
    'refund_payment_id', v_payment_id,
    'refund_amount', p_refund_amount,
    'voided_invoice_count', v_voided_count
  );

  UPDATE public.membership_action_attempts
     SET status = 'succeeded', result = v_existing, completed_at = now()
   WHERE idempotency_key = v_key;

  PERFORM pg_notify('membership_cancelled',
    jsonb_build_object('membership_id', p_membership_id, 'member_id', v_membership.member_id)::text);

  RETURN v_existing;
EXCEPTION WHEN OTHERS THEN
  UPDATE public.membership_action_attempts
     SET status = 'failed', error = SQLERRM, completed_at = now()
   WHERE idempotency_key = v_key;
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_membership(uuid,text,numeric,text,text) TO authenticated;

UPDATE public.invoices i
   SET status = 'cancelled'::invoice_status,
       notes = COALESCE(i.notes,'') || E'\nAuto-cancelled: linked membership cancelled.'
 WHERE i.status::text IN ('pending','partial','overdue')
   AND COALESCE(i.amount_paid,0) = 0
   AND EXISTS (
     SELECT 1 FROM public.invoice_items ii
     JOIN public.memberships m ON m.id = ii.reference_id
     WHERE ii.invoice_id = i.id
       AND ii.reference_type = 'membership'
       AND m.status = 'cancelled'
   );