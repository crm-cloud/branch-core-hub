-- ============================================================================
-- Phase 1: GST Inclusive Pricing Bug Fix
-- ============================================================================
-- Problem: purchase_member_membership and create_manual_invoice were treating
-- p_include_gst as "add tax on top" even when the plan price was already
-- GST-inclusive. This caused double taxation (₹10,000 plan -> ₹11,800 invoice).
--
-- Fix: Honour membership_plans.is_gst_inclusive. When inclusive, extract tax
-- out of the gross price (total stays the same). Add an explicit
-- p_gst_inclusive parameter to create_manual_invoice for flexibility.
-- ============================================================================

-- Update purchase_member_membership to honour plan's is_gst_inclusive flag
CREATE OR REPLACE FUNCTION public.purchase_member_membership(
  p_member_id uuid,
  p_plan_id uuid,
  p_branch_id uuid,
  p_start_date date,
  p_discount_amount numeric DEFAULT 0,
  p_discount_reason text DEFAULT NULL::text,
  p_include_gst boolean DEFAULT false,
  p_gst_rate numeric DEFAULT 0,
  p_payment_method text DEFAULT 'cash'::text,
  p_amount_paying numeric DEFAULT 0,
  p_payment_due_date date DEFAULT NULL::date,
  p_send_reminders boolean DEFAULT true,
  p_payment_source text DEFAULT 'manual'::text,
  p_idempotency_key text DEFAULT NULL::text,
  p_assign_locker_id uuid DEFAULT NULL::uuid,
  p_notes text DEFAULT NULL::text,
  p_received_by uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_member public.members%ROWTYPE;
  v_plan public.membership_plans%ROWTYPE;
  v_membership public.memberships%ROWTYPE;
  v_invoice public.invoices%ROWTYPE;
  v_existing_event public.member_lifecycle_events%ROWTYPE;
  v_base_price numeric := 0;
  v_admission_fee numeric := 0;
  v_gross_amount numeric := 0;          -- consumer-facing total before tax-extraction
  v_subtotal numeric := 0;              -- taxable base on invoice
  v_tax_amount numeric := 0;
  v_total_amount numeric := 0;          -- what the member actually pays
  v_end_date date;
  v_payment_result jsonb;
  v_remaining_amount numeric := 0;
  v_due_date date;
  v_effective_rate numeric := 0;
  v_is_inclusive boolean := false;
  v_gst record;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_event
    FROM public.member_lifecycle_events
    WHERE member_id = p_member_id
      AND entity_type = 'membership_purchase'
      AND idempotency_key = p_idempotency_key
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'member_id', p_member_id, 'idempotent', true, 'entity_id', v_existing_event.entity_id);
    END IF;
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Member not found'); END IF;
  IF v_member.branch_id <> p_branch_id THEN RETURN jsonb_build_object('success', false, 'error', 'Member branch mismatch'); END IF;

  SELECT * INTO v_plan FROM public.membership_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Membership plan not found'); END IF;

  v_base_price := COALESCE(v_plan.discounted_price, v_plan.price, 0);
  v_admission_fee := COALESCE(v_plan.admission_fee, 0);

  -- Gross amount = what's printed on the price tag (always the same regardless of GST flag)
  v_gross_amount := GREATEST(v_base_price + v_admission_fee - COALESCE(p_discount_amount, 0), 0);

  -- Effective GST rate: prefer caller-supplied, fallback to plan's configured rate
  v_effective_rate := COALESCE(NULLIF(p_gst_rate, 0), COALESCE(v_plan.gst_rate, 0));
  v_is_inclusive := COALESCE(v_plan.is_gst_inclusive, true);

  IF p_include_gst AND v_effective_rate > 0 THEN
    -- Use calc_gst: when plan is inclusive, extract tax out of gross.
    -- When plan is exclusive, add tax on top.
    SELECT * INTO v_gst FROM public.calc_gst(v_gross_amount, v_effective_rate, v_is_inclusive, true);
    v_subtotal := v_gst.taxable;
    v_tax_amount := v_gst.cgst + v_gst.sgst + v_gst.igst;
    v_total_amount := v_gst.total;
  ELSE
    -- No GST breakup on this invoice. Total = gross (member pays the same).
    v_subtotal := v_gross_amount;
    v_tax_amount := 0;
    v_total_amount := v_gross_amount;
  END IF;

  v_due_date := COALESCE(p_payment_due_date, p_start_date);
  v_end_date := (p_start_date + make_interval(days => GREATEST(COALESCE(v_plan.duration_days, 1) - 1, 0)))::date;

  INSERT INTO public.memberships (
    member_id, plan_id, branch_id, status, start_date, end_date, original_end_date,
    price_paid, discount_amount, discount_reason, notes, created_by
  ) VALUES (
    p_member_id, p_plan_id, p_branch_id, 'pending'::public.membership_status,
    p_start_date, v_end_date, v_end_date, v_total_amount,
    COALESCE(p_discount_amount, 0), p_discount_reason, p_notes, p_received_by
  ) RETURNING * INTO v_membership;

  INSERT INTO public.invoices (
    branch_id, member_id, status, subtotal, discount_amount, tax_amount, total_amount,
    amount_paid, due_date, payment_due_date, notes, created_by,
    is_gst_invoice, gst_rate, source, invoice_type
  ) VALUES (
    p_branch_id, p_member_id, 'pending'::public.invoice_status,
    v_subtotal, COALESCE(p_discount_amount, 0), v_tax_amount, v_total_amount, 0,
    v_due_date,
    CASE WHEN p_amount_paying < v_total_amount THEN v_due_date ELSE NULL END,
    p_notes, p_received_by,
    p_include_gst,
    CASE WHEN p_include_gst THEN v_effective_rate ELSE 0 END,
    p_payment_source, 'membership'
  ) RETURNING * INTO v_invoice;

  -- Plan line item: store the *taxable* base on tax invoices, gross on receipts.
  -- This keeps invoice_items.total_amount honest for both presentations.
  INSERT INTO public.invoice_items (
    invoice_id, description, quantity, unit_price, total_amount, reference_type, reference_id
  ) VALUES (
    v_invoice.id,
    format('%s - %s days', v_plan.name, v_plan.duration_days),
    1,
    CASE WHEN p_include_gst AND v_is_inclusive AND v_effective_rate > 0
         THEN round(v_base_price / (1 + v_effective_rate/100.0), 2)
         ELSE v_base_price END,
    CASE WHEN p_include_gst AND v_is_inclusive AND v_effective_rate > 0
         THEN round(v_base_price / (1 + v_effective_rate/100.0), 2)
         ELSE v_base_price END,
    'membership',
    v_membership.id
  );

  IF v_admission_fee > 0 THEN
    INSERT INTO public.invoice_items (
      invoice_id, description, quantity, unit_price, total_amount, reference_type, reference_id
    ) VALUES (
      v_invoice.id, 'Admission Fee', 1,
      CASE WHEN p_include_gst AND v_is_inclusive AND v_effective_rate > 0
           THEN round(v_admission_fee / (1 + v_effective_rate/100.0), 2)
           ELSE v_admission_fee END,
      CASE WHEN p_include_gst AND v_is_inclusive AND v_effective_rate > 0
           THEN round(v_admission_fee / (1 + v_effective_rate/100.0), 2)
           ELSE v_admission_fee END,
      'admission_fee', v_membership.id
    );
  END IF;

  IF p_assign_locker_id IS NOT NULL AND COALESCE(v_plan.includes_free_locker, false) THEN
    INSERT INTO public.locker_assignments (locker_id, member_id, start_date, end_date, fee_amount, is_active)
    VALUES (p_assign_locker_id, p_member_id, p_start_date, v_end_date, 0, false);
  END IF;

  IF COALESCE(p_amount_paying, 0) > 0 THEN
    v_payment_result := public.settle_payment(
      p_branch_id, v_invoice.id, p_member_id, p_amount_paying, p_payment_method,
      NULL, p_notes, p_received_by, NULL, p_payment_source, p_idempotency_key, NULL, NULL,
      jsonb_build_object('membership_id', v_membership.id, 'plan_id', p_plan_id)
    );
    IF COALESCE((v_payment_result ->> 'success')::boolean, false) IS NOT TRUE THEN
      RETURN v_payment_result;
    END IF;
  END IF;

  SELECT * INTO v_invoice FROM public.invoices WHERE id = v_invoice.id;
  v_remaining_amount := GREATEST(COALESCE(v_invoice.total_amount, 0) - COALESCE(v_invoice.amount_paid, 0), 0);

  UPDATE public.memberships
  SET status = CASE WHEN v_invoice.status = 'paid'::public.invoice_status THEN 'active'::public.membership_status ELSE 'pending'::public.membership_status END,
      updated_at = now()
  WHERE id = v_membership.id
  RETURNING * INTO v_membership;

  IF p_send_reminders AND v_remaining_amount > 0 THEN
    INSERT INTO public.payment_reminders (
      branch_id, invoice_id, member_id, reminder_type, scheduled_for, status, delivery_status, channel
    )
    SELECT p_branch_id, v_invoice.id, p_member_id, reminder_type, scheduled_for, 'pending', 'scheduled'::public.reminder_delivery_status, channel
    FROM (VALUES
      ('payment_due', (v_due_date - INTERVAL '3 days')::timestamptz, 'whatsapp'),
      ('payment_due', v_due_date::timestamptz, 'sms'),
      ('overdue', (v_due_date + INTERVAL '3 days')::timestamptz, 'email')
    ) AS reminder_plan(reminder_type, scheduled_for, channel)
    WHERE scheduled_for > now();
  END IF;

  IF p_assign_locker_id IS NOT NULL AND COALESCE(v_plan.includes_free_locker, false) AND v_invoice.status = 'paid'::public.invoice_status THEN
    UPDATE public.locker_assignments SET is_active = true
    WHERE member_id = p_member_id AND locker_id = p_assign_locker_id AND start_date = p_start_date;
    UPDATE public.lockers SET status = 'assigned' WHERE id = p_assign_locker_id;
  END IF;

  PERFORM public.log_member_lifecycle_event(
    p_branch_id, p_member_id, p_received_by, 'membership_purchase',
    v_membership.id, 'membership_purchased', NULL, v_membership.status::text,
    p_payment_source, p_notes, p_idempotency_key,
    jsonb_build_object('invoice_id', v_invoice.id, 'plan_id', p_plan_id, 'remaining_amount', v_remaining_amount)
  );

  PERFORM public.evaluate_member_access_state(p_member_id, p_received_by, 'Membership purchase evaluated', true);

  RETURN jsonb_build_object(
    'success', true, 'member_id', p_member_id, 'membership_id', v_membership.id,
    'invoice_id', v_invoice.id, 'invoice_status', v_invoice.status,
    'membership_status', v_membership.status, 'amount_paid', v_invoice.amount_paid,
    'remaining_amount', v_remaining_amount, 'total_amount', v_invoice.total_amount
  );
END;
$function$;


-- Update create_manual_invoice to accept an explicit gst_inclusive flag.
-- When TRUE + p_include_gst: items are treated as gross (extract tax out).
-- When FALSE + p_include_gst: items are treated as net (add tax on top, legacy behaviour).
CREATE OR REPLACE FUNCTION public.create_manual_invoice(
  p_branch_id uuid,
  p_member_id uuid,
  p_items jsonb,
  p_due_date date DEFAULT NULL::date,
  p_notes text DEFAULT NULL::text,
  p_discount_amount numeric DEFAULT 0,
  p_include_gst boolean DEFAULT false,
  p_gst_rate numeric DEFAULT 0,
  p_customer_gstin text DEFAULT NULL::text,
  p_gst_inclusive boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_gross numeric := 0;       -- sum of qty*unit_price as supplied
  v_subtotal numeric := 0;    -- taxable base on invoice
  v_tax numeric := 0;
  v_total numeric := 0;
  v_invoice_id uuid;
  v_invoice_number text;
  v_item jsonb;
  v_item_unit numeric;
  v_item_qty numeric;
BEGIN
  IF p_branch_id IS NULL THEN RAISE EXCEPTION 'BRANCH_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'NO_ITEMS' USING ERRCODE = '22023'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_gross := v_gross + (COALESCE((v_item->>'quantity')::numeric, 1) * COALESCE((v_item->>'unit_price')::numeric, 0));
  END LOOP;

  IF p_include_gst AND p_gst_rate > 0 THEN
    IF p_gst_inclusive THEN
      -- Extract tax out of gross. Total stays equal to gross-discount.
      v_subtotal := round((v_gross - COALESCE(p_discount_amount, 0)) / (1 + p_gst_rate/100.0), 2);
      v_total    := round(v_gross - COALESCE(p_discount_amount, 0), 2);
      v_tax      := round(v_total - v_subtotal, 2);
    ELSE
      -- Legacy: add tax on top of (gross - discount).
      v_subtotal := round(v_gross - COALESCE(p_discount_amount, 0), 2);
      v_tax := round(v_subtotal * p_gst_rate / 100.0, 2);
      v_total := v_subtotal + v_tax;
    END IF;
  ELSE
    v_subtotal := round(v_gross - COALESCE(p_discount_amount, 0), 2);
    v_total := v_subtotal;
  END IF;

  INSERT INTO public.invoices (
    branch_id, member_id, invoice_number, subtotal, discount_amount, tax_amount, total_amount,
    status, due_date, notes, is_gst_invoice, gst_rate, customer_gstin
  ) VALUES (
    p_branch_id, p_member_id, NULL, v_subtotal, COALESCE(p_discount_amount, 0), v_tax, v_total,
    'pending', p_due_date, p_notes,
    COALESCE(p_include_gst, false),
    CASE WHEN p_include_gst THEN p_gst_rate ELSE 0 END,
    CASE WHEN p_include_gst THEN p_customer_gstin ELSE NULL END
  ) RETURNING id, invoice_number INTO v_invoice_id, v_invoice_number;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_item_qty := COALESCE((v_item->>'quantity')::numeric, 1);
    v_item_unit := COALESCE((v_item->>'unit_price')::numeric, 0);
    -- When gst-inclusive, store the taxable portion as the line unit price so
    -- line totals + tax = invoice total (clean for accounting).
    IF p_include_gst AND p_gst_inclusive AND p_gst_rate > 0 THEN
      v_item_unit := round(v_item_unit / (1 + p_gst_rate/100.0), 2);
    END IF;
    INSERT INTO public.invoice_items (
      invoice_id, description, quantity, unit_price, total_amount, reference_type, reference_id
    ) VALUES (
      v_invoice_id, v_item->>'description', v_item_qty, v_item_unit, v_item_qty * v_item_unit,
      v_item->>'reference_type', NULLIF(v_item->>'reference_id', '')::uuid
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 'invoice_id', v_invoice_id, 'invoice_number', v_invoice_number, 'total_amount', v_total
  );
END;
$function$;