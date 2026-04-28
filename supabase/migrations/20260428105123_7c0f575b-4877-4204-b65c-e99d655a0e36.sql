CREATE OR REPLACE FUNCTION public.purchase_pt_package(
  p_member_id uuid,
  p_package_id uuid,
  p_branch_id uuid,
  p_trainer_id uuid DEFAULT NULL,
  p_payment_source text DEFAULT 'payment_link',
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pkg record;
  v_invoice_id uuid;
  v_existing_invoice_id uuid;
  v_today date := CURRENT_DATE;
  v_total numeric;
  v_notes text;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_invoice_id
    FROM public.invoices
    WHERE notes ILIKE '%' || p_idempotency_key || '%'
    ORDER BY created_at DESC LIMIT 1;
    IF v_existing_invoice_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'invoice_id', v_existing_invoice_id, 'idempotent', true);
    END IF;
  END IF;

  SELECT id, name, price, total_sessions, validity_days
    INTO v_pkg
  FROM pt_packages
  WHERE id = p_package_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'PT package not found'; END IF;

  v_total := COALESCE(v_pkg.price, 0);
  v_notes := 'PT Package Purchase: ' || v_pkg.name ||
    CASE WHEN p_trainer_id IS NOT NULL THEN ' | Preferred trainer: ' || p_trainer_id::text ELSE '' END ||
    CASE WHEN p_idempotency_key IS NOT NULL THEN ' [idem:' || p_idempotency_key || ']' ELSE '' END;

  INSERT INTO invoices (
    branch_id, member_id, invoice_number,
    subtotal, total_amount, amount_paid, status,
    due_date, source, notes
  ) VALUES (
    p_branch_id, p_member_id, NULL,
    v_total, v_total, 0, 'pending'::invoice_status,
    v_today, 'pt_package',
    v_notes
  ) RETURNING id INTO v_invoice_id;

  INSERT INTO invoice_items (
    invoice_id, description, quantity, unit_price, total_amount,
    reference_type, reference_id
  ) VALUES (
    v_invoice_id,
    v_pkg.name || ' (' || COALESCE(v_pkg.total_sessions, 0) || ' sessions, ' || COALESCE(v_pkg.validity_days, 90) || ' days)',
    1, v_total, v_total, 'pt_package', v_pkg.id
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'total', v_total
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.purchase_pt_package(uuid, uuid, uuid, uuid, text, text) TO authenticated;