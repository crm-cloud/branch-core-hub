
-- =====================================================================
-- 1. ad-banners public bucket + RLS
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('ad-banners', 'ad-banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public can view ad banners" ON storage.objects;
CREATE POLICY "Public can view ad banners"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ad-banners');

DROP POLICY IF EXISTS "Staff can upload ad banners" ON storage.objects;
CREATE POLICY "Staff can upload ad banners"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ad-banners'
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::public.app_role[])
  );

DROP POLICY IF EXISTS "Staff can update ad banners" ON storage.objects;
CREATE POLICY "Staff can update ad banners"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'ad-banners'
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::public.app_role[])
  );

DROP POLICY IF EXISTS "Staff can delete ad banners" ON storage.objects;
CREATE POLICY "Staff can delete ad banners"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ad-banners'
    AND public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::public.app_role[])
  );

-- =====================================================================
-- 2. Biometric storage path access for member-photos bucket
-- =====================================================================
CREATE OR REPLACE FUNCTION public.can_access_biometric_photo(_user_id uuid, _path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_first text := split_part(coalesce(_path, ''), '/', 1);
  v_kind  text := split_part(coalesce(_path, ''), '/', 2);
  v_id    uuid;
  v_member public.members%ROWTYPE;
BEGIN
  IF v_first <> 'biometric' THEN
    RETURN false;
  END IF;

  -- Owners/admins/managers always allowed.
  IF public.has_any_role(_user_id, ARRAY['owner','admin','manager']::public.app_role[]) THEN
    RETURN true;
  END IF;

  -- Parse the entity uuid from segment 3 (strip extension).
  BEGIN
    v_id := split_part(split_part(_path, '/', 3), '.', 1)::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  IF v_kind = 'members' THEN
    SELECT * INTO v_member FROM public.members WHERE id = v_id;
    IF NOT FOUND THEN RETURN false; END IF;
    IF v_member.user_id = _user_id THEN RETURN true; END IF;
    -- Branch staff at the member's branch.
    IF EXISTS (
      SELECT 1 FROM public.staff_branches sb
      WHERE sb.user_id = _user_id AND sb.branch_id = v_member.branch_id
    ) THEN RETURN true; END IF;
    RETURN false;
  ELSIF v_kind = 'trainers' THEN
    RETURN EXISTS (SELECT 1 FROM public.trainers t WHERE t.id = v_id AND t.user_id = _user_id);
  ELSIF v_kind = 'employees' THEN
    RETURN EXISTS (SELECT 1 FROM public.employees e WHERE e.id = v_id AND e.user_id = _user_id);
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_write_biometric_photo(_user_id uuid, _path text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.can_access_biometric_photo(_user_id, _path);
$$;

DROP POLICY IF EXISTS "Authorized users can view biometric photos" ON storage.objects;
CREATE POLICY "Authorized users can view biometric photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'member-photos'
    AND name LIKE 'biometric/%'
    AND public.can_access_biometric_photo(auth.uid(), name)
  );

DROP POLICY IF EXISTS "Authorized users can upload biometric photos" ON storage.objects;
CREATE POLICY "Authorized users can upload biometric photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'member-photos'
    AND name LIKE 'biometric/%'
    AND public.can_write_biometric_photo(auth.uid(), name)
  );

DROP POLICY IF EXISTS "Authorized users can update biometric photos" ON storage.objects;
CREATE POLICY "Authorized users can update biometric photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'member-photos'
    AND name LIKE 'biometric/%'
    AND public.can_write_biometric_photo(auth.uid(), name)
  );

DROP POLICY IF EXISTS "Authorized users can delete biometric photos" ON storage.objects;
CREATE POLICY "Authorized users can delete biometric photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'member-photos'
    AND name LIKE 'biometric/%'
    AND public.can_write_biometric_photo(auth.uid(), name)
  );

-- =====================================================================
-- 3. assign_locker_with_invoice RPC
-- =====================================================================
CREATE OR REPLACE FUNCTION public.assign_locker_with_invoice(
  p_locker_id uuid,
  p_member_id uuid,
  p_start_date date,
  p_end_date date,
  p_fee_amount numeric DEFAULT 0,
  p_billing_months integer DEFAULT 1,
  p_chargeable boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_locker public.lockers%ROWTYPE;
  v_assignment_id uuid;
  v_invoice_id uuid;
  v_branch_id uuid;
BEGIN
  SELECT * INTO v_locker FROM public.lockers WHERE id = p_locker_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Locker not found');
  END IF;
  IF v_locker.status <> 'available' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Locker is not available');
  END IF;

  v_branch_id := v_locker.branch_id;

  INSERT INTO public.locker_assignments (
    locker_id, member_id, start_date, end_date, fee_amount, is_active
  ) VALUES (
    p_locker_id, p_member_id, p_start_date, p_end_date, COALESCE(p_fee_amount, 0), true
  ) RETURNING id INTO v_assignment_id;

  UPDATE public.lockers SET status = 'assigned', updated_at = now() WHERE id = p_locker_id;

  IF p_chargeable AND COALESCE(p_fee_amount, 0) > 0 THEN
    INSERT INTO public.invoices (
      branch_id, member_id, subtotal, total_amount, amount_paid,
      status, due_date, invoice_type
    ) VALUES (
      v_branch_id, p_member_id, p_fee_amount, p_fee_amount, 0,
      'pending'::public.invoice_status,
      (CURRENT_DATE + INTERVAL '7 days')::date,
      'locker'
    ) RETURNING id INTO v_invoice_id;

    INSERT INTO public.invoice_items (
      invoice_id, description, unit_price, quantity, total_amount,
      reference_type, reference_id
    ) VALUES (
      v_invoice_id,
      format('Locker #%s rental (%s month%s)', v_locker.locker_number, p_billing_months,
             CASE WHEN p_billing_months = 1 THEN '' ELSE 's' END),
      ROUND(p_fee_amount::numeric / NULLIF(p_billing_months, 0), 2),
      p_billing_months,
      p_fee_amount,
      'locker',
      p_locker_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_assignment_id,
    'invoice_id', v_invoice_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_locker_with_invoice(uuid, uuid, date, date, numeric, integer, boolean) TO authenticated;

-- =====================================================================
-- 4. member_force_check_in RPC
-- =====================================================================
CREATE OR REPLACE FUNCTION public.member_force_check_in(
  p_member_id uuid,
  p_branch_id uuid,
  p_reason text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing public.member_attendance%ROWTYPE;
  v_attendance_id uuid;
BEGIN
  -- Per-member advisory lock to serialize concurrent force entries.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_member_id::text, 0));

  SELECT * INTO v_existing
  FROM public.member_attendance
  WHERE member_id = p_member_id AND check_out IS NULL
  ORDER BY check_in DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'already_checked_in',
      'attendance_id', v_existing.id,
      'message', 'Member is already checked in'
    );
  END IF;

  INSERT INTO public.member_attendance (
    member_id, branch_id, check_in, check_in_method,
    force_entry, force_entry_reason, force_entry_by
  ) VALUES (
    p_member_id, p_branch_id, now(), 'force_entry',
    true, COALESCE(p_reason, 'Override by reception'), p_actor_user_id
  ) RETURNING id INTO v_attendance_id;

  RETURN jsonb_build_object(
    'success', true,
    'attendance_id', v_attendance_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.member_force_check_in(uuid, uuid, text, uuid) TO authenticated;

-- =====================================================================
-- 5. purchase_benefit_credits RPC (routes through settle_payment)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.purchase_benefit_credits(
  p_member_id uuid,
  p_membership_id uuid,
  p_package_id uuid,
  p_branch_id uuid DEFAULT NULL,
  p_payment_method text DEFAULT 'cash',
  p_idempotency_key text DEFAULT NULL,
  p_received_by uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pkg RECORD;
  v_branch_id uuid;
  v_invoice_id uuid;
  v_credit_id uuid;
  v_settle_result jsonb;
  v_expires_at timestamptz;
BEGIN
  SELECT * INTO v_pkg FROM public.benefit_packages WHERE id = p_package_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Package not found');
  END IF;

  v_branch_id := COALESCE(p_branch_id, v_pkg.branch_id);
  IF v_branch_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Branch missing');
  END IF;

  INSERT INTO public.invoices (
    branch_id, member_id, subtotal, total_amount, amount_paid,
    status, due_date, invoice_type
  ) VALUES (
    v_branch_id, p_member_id, v_pkg.price, v_pkg.price, 0,
    'pending'::public.invoice_status, CURRENT_DATE, 'benefit_addon'
  ) RETURNING id INTO v_invoice_id;

  INSERT INTO public.invoice_items (
    invoice_id, description, unit_price, quantity, total_amount,
    reference_type, reference_id
  ) VALUES (
    v_invoice_id,
    format('Add-on: %s (%s credits)', v_pkg.name, v_pkg.quantity),
    v_pkg.price, 1, v_pkg.price,
    'benefit_addon', p_package_id
  );

  v_settle_result := public.settle_payment(
    v_branch_id,
    v_invoice_id,
    p_member_id,
    v_pkg.price,
    p_payment_method,
    NULL, NULL, p_received_by, NULL,
    'benefit_addon',
    p_idempotency_key,
    NULL, NULL,
    jsonb_build_object('package_id', p_package_id, 'membership_id', p_membership_id)
  );

  IF COALESCE((v_settle_result ->> 'success')::boolean, false) IS NOT TRUE THEN
    -- Roll the invoice back so we don't leave an orphan.
    DELETE FROM public.invoice_items WHERE invoice_id = v_invoice_id;
    DELETE FROM public.invoices WHERE id = v_invoice_id;
    RETURN v_settle_result;
  END IF;

  v_expires_at := now() + (v_pkg.validity_days || ' days')::interval;

  INSERT INTO public.member_benefit_credits (
    member_id, membership_id, benefit_type, package_id,
    credits_total, credits_remaining, expires_at, invoice_id
  ) VALUES (
    p_member_id, p_membership_id, v_pkg.benefit_type, p_package_id,
    v_pkg.quantity, v_pkg.quantity, v_expires_at, v_invoice_id
  ) RETURNING id INTO v_credit_id;

  RETURN jsonb_build_object(
    'success', true,
    'credit_id', v_credit_id,
    'invoice_id', v_invoice_id,
    'amount', v_pkg.price
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_benefit_credits(uuid, uuid, uuid, uuid, text, text, uuid) TO authenticated;

-- =====================================================================
-- 6. Rewrite purchase_pt_package to route through settle_payment
-- =====================================================================
CREATE OR REPLACE FUNCTION public.purchase_pt_package(
  _member_id uuid,
  _package_id uuid,
  _trainer_id uuid,
  _branch_id uuid,
  _price_paid numeric,
  _payment_method text DEFAULT 'cash',
  _idempotency_key text DEFAULT NULL,
  _received_by uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _package RECORD;
  _member_package_id uuid;
  _commission_amount numeric;
  _monthly_commission numeric;
  _commission_rate numeric;
  _invoice_id uuid;
  _settle_result jsonb;
  i INTEGER;
BEGIN
  SELECT * INTO _package FROM public.pt_packages WHERE id = _package_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Package not found or inactive');
  END IF;

  SELECT pt_share_percentage INTO _commission_rate FROM public.trainers WHERE id = _trainer_id;
  _commission_rate := COALESCE(_commission_rate, 20);

  INSERT INTO public.member_pt_packages (
    member_id, package_id, trainer_id, branch_id,
    sessions_total, sessions_remaining, price_paid,
    start_date, expiry_date, status
  ) VALUES (
    _member_id, _package_id, _trainer_id, _branch_id,
    CASE WHEN _package.package_type = 'duration_based' THEN 0 ELSE _package.total_sessions END,
    CASE WHEN _package.package_type = 'duration_based' THEN 0 ELSE _package.total_sessions END,
    _price_paid,
    CURRENT_DATE,
    CASE WHEN _package.package_type = 'duration_based' THEN CURRENT_DATE + (_package.duration_months * 30)
         ELSE CURRENT_DATE + _package.validity_days END,
    'pending'
  ) RETURNING id INTO _member_package_id;

  INSERT INTO public.invoices (
    branch_id, member_id, subtotal, total_amount, amount_paid,
    status, due_date, invoice_type
  ) VALUES (
    _branch_id, _member_id, _price_paid, _price_paid, 0,
    'pending'::public.invoice_status, CURRENT_DATE, 'pt_package'
  ) RETURNING id INTO _invoice_id;

  INSERT INTO public.invoice_items (
    invoice_id, description, unit_price, quantity, total_amount,
    reference_type, reference_id
  ) VALUES (
    _invoice_id,
    'PT Package - ' || _package.name,
    _price_paid, 1, _price_paid,
    'pt_package', _member_package_id
  );

  _settle_result := public.settle_payment(
    _branch_id,
    _invoice_id,
    _member_id,
    _price_paid,
    _payment_method,
    NULL, NULL, _received_by, NULL,
    'pt_purchase',
    COALESCE(_idempotency_key, _member_package_id::text),
    NULL, NULL,
    jsonb_build_object('member_pt_package_id', _member_package_id, 'trainer_id', _trainer_id)
  );

  IF COALESCE((_settle_result ->> 'success')::boolean, false) IS NOT TRUE THEN
    -- Settlement failed — clean up the package row to avoid orphans.
    DELETE FROM public.invoice_items WHERE invoice_id = _invoice_id;
    DELETE FROM public.invoices WHERE id = _invoice_id;
    DELETE FROM public.member_pt_packages WHERE id = _member_package_id;
    RETURN _settle_result;
  END IF;

  -- Activate the package now that payment is settled.
  UPDATE public.member_pt_packages SET status = 'active' WHERE id = _member_package_id;

  -- Trainer commissions (unchanged behavior).
  _commission_amount := _price_paid * (_commission_rate / 100.0);
  IF _package.package_type = 'duration_based' AND _package.duration_months > 0 THEN
    _monthly_commission := ROUND(_commission_amount / _package.duration_months, 2);
    FOR i IN 0..(_package.duration_months - 1) LOOP
      INSERT INTO public.trainer_commissions (
        trainer_id, pt_package_id, commission_type, amount, percentage, status, release_date
      ) VALUES (
        _trainer_id, _member_package_id, 'package_sale',
        _monthly_commission, _commission_rate, 'pending',
        CURRENT_DATE + (i * 30)
      );
    END LOOP;
  ELSE
    INSERT INTO public.trainer_commissions (
      trainer_id, pt_package_id, commission_type, amount, percentage, release_date
    ) VALUES (
      _trainer_id, _member_package_id, 'package_sale',
      _commission_amount, _commission_rate, CURRENT_DATE
    );
  END IF;

  UPDATE public.members SET assigned_trainer_id = _trainer_id
  WHERE id = _member_id AND assigned_trainer_id IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'member_package_id', _member_package_id,
    'invoice_id', _invoice_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_pt_package(uuid, uuid, uuid, uuid, numeric, text, text, uuid) TO authenticated;
