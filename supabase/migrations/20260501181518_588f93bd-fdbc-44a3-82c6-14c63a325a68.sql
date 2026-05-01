
-- ============================================================================
-- PART A: COUPON REDEMPTION ENGINE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.discount_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id uuid NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  code text NOT NULL,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  subtotal numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  reference_type text,            -- 'invoice' | 'sale' | 'order'
  reference_id uuid,
  idempotency_key text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_code ON public.discount_redemptions(discount_code_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_member ON public.discount_redemptions(member_id);
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_ref ON public.discount_redemptions(reference_type, reference_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_discount_redemptions_idem ON public.discount_redemptions(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.discount_redemption_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  discount_code_id uuid REFERENCES public.discount_codes(id) ON DELETE SET NULL,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  subtotal numeric DEFAULT 0,
  reason text NOT NULL,            -- 'not_found' | 'inactive' | 'expired' | 'not_started' | 'max_uses' | 'min_purchase' | 'wrong_branch'
  attempted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_discount_attempts_code ON public.discount_redemption_attempts(discount_code_id, created_at DESC);

ALTER TABLE public.discount_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_redemption_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='discount_redemptions' AND policyname='discount_redemptions_staff_all') THEN
    CREATE POLICY discount_redemptions_staff_all ON public.discount_redemptions FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'staff'))
      WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'staff'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='discount_redemptions' AND policyname='discount_redemptions_member_own') THEN
    CREATE POLICY discount_redemptions_member_own ON public.discount_redemptions FOR SELECT TO authenticated
      USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='discount_redemption_attempts' AND policyname='discount_attempts_staff_all') THEN
    CREATE POLICY discount_attempts_staff_all ON public.discount_redemption_attempts FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'staff'))
      WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'staff'));
  END IF;
END $$;

-- Read-only validator (no row writes, no usage increment) — used for live preview
CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_code text,
  p_branch_id uuid,
  p_subtotal numeric
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c RECORD;
  v_discount numeric;
BEGIN
  SELECT * INTO c FROM public.discount_codes WHERE upper(code) = upper(p_code) LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'reason', 'not_found'); END IF;
  IF NOT COALESCE(c.is_active,false) THEN RETURN jsonb_build_object('success', false, 'reason', 'inactive', 'code_id', c.id); END IF;
  IF c.valid_from IS NOT NULL AND now() < c.valid_from THEN RETURN jsonb_build_object('success', false, 'reason', 'not_started', 'code_id', c.id); END IF;
  IF c.valid_until IS NOT NULL AND now() > c.valid_until THEN RETURN jsonb_build_object('success', false, 'reason', 'expired', 'code_id', c.id); END IF;
  IF c.max_uses IS NOT NULL AND COALESCE(c.times_used,0) >= c.max_uses THEN RETURN jsonb_build_object('success', false, 'reason', 'max_uses', 'code_id', c.id); END IF;
  IF c.min_purchase IS NOT NULL AND p_subtotal < c.min_purchase THEN RETURN jsonb_build_object('success', false, 'reason', 'min_purchase', 'code_id', c.id, 'min_purchase', c.min_purchase); END IF;
  IF c.branch_id IS NOT NULL AND p_branch_id IS NOT NULL AND c.branch_id <> p_branch_id THEN RETURN jsonb_build_object('success', false, 'reason', 'wrong_branch', 'code_id', c.id); END IF;

  IF c.discount_type = 'percentage' THEN
    v_discount := round(p_subtotal * COALESCE(c.discount_value,0) / 100.0, 2);
  ELSE
    v_discount := LEAST(COALESCE(c.discount_value,0), p_subtotal);
  END IF;
  v_discount := GREATEST(0, v_discount);

  RETURN jsonb_build_object(
    'success', true,
    'code_id', c.id,
    'code', c.code,
    'discount_type', c.discount_type,
    'discount_value', c.discount_value,
    'discount_amount', v_discount,
    'remaining_uses', CASE WHEN c.max_uses IS NULL THEN NULL ELSE c.max_uses - COALESCE(c.times_used,0) - 1 END
  );
END $$;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, uuid, numeric) TO authenticated;

-- Atomic redeem (locks row, increments times_used, inserts redemption)
CREATE OR REPLACE FUNCTION public.redeem_coupon(
  p_code text,
  p_branch_id uuid,
  p_member_id uuid,
  p_subtotal numeric,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c RECORD;
  v_discount numeric;
  v_existing_id uuid;
  v_redemption_id uuid;
  v_reason text;
BEGIN
  -- Idempotency short-circuit
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.discount_redemptions WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      SELECT jsonb_build_object('success', true, 'redemption_id', id, 'discount_amount', discount_amount, 'code_id', discount_code_id, 'replayed', true)
        INTO v_existing_id FROM public.discount_redemptions WHERE id = v_existing_id;
      RETURN to_jsonb(v_existing_id);
    END IF;
  END IF;

  -- Lock the row
  SELECT * INTO c FROM public.discount_codes WHERE upper(code) = upper(p_code) FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.discount_redemption_attempts(code, member_id, branch_id, subtotal, reason, attempted_by)
      VALUES (p_code, p_member_id, p_branch_id, p_subtotal, 'not_found', auth.uid());
    RETURN jsonb_build_object('success', false, 'reason', 'not_found');
  END IF;

  v_reason := NULL;
  IF NOT COALESCE(c.is_active,false) THEN v_reason := 'inactive';
  ELSIF c.valid_from IS NOT NULL AND now() < c.valid_from THEN v_reason := 'not_started';
  ELSIF c.valid_until IS NOT NULL AND now() > c.valid_until THEN v_reason := 'expired';
  ELSIF c.max_uses IS NOT NULL AND COALESCE(c.times_used,0) >= c.max_uses THEN v_reason := 'max_uses';
  ELSIF c.min_purchase IS NOT NULL AND p_subtotal < c.min_purchase THEN v_reason := 'min_purchase';
  ELSIF c.branch_id IS NOT NULL AND p_branch_id IS NOT NULL AND c.branch_id <> p_branch_id THEN v_reason := 'wrong_branch';
  END IF;

  IF v_reason IS NOT NULL THEN
    INSERT INTO public.discount_redemption_attempts(code, discount_code_id, member_id, branch_id, subtotal, reason, attempted_by)
      VALUES (p_code, c.id, p_member_id, p_branch_id, p_subtotal, v_reason, auth.uid());
    RETURN jsonb_build_object('success', false, 'reason', v_reason, 'code_id', c.id);
  END IF;

  IF c.discount_type = 'percentage' THEN
    v_discount := round(p_subtotal * COALESCE(c.discount_value,0) / 100.0, 2);
  ELSE
    v_discount := LEAST(COALESCE(c.discount_value,0), p_subtotal);
  END IF;
  v_discount := GREATEST(0, v_discount);

  UPDATE public.discount_codes SET times_used = COALESCE(times_used,0) + 1 WHERE id = c.id;

  INSERT INTO public.discount_redemptions(
    discount_code_id, code, member_id, branch_id, subtotal, discount_amount,
    reference_type, reference_id, idempotency_key, created_by
  ) VALUES (
    c.id, c.code, p_member_id, p_branch_id, p_subtotal, v_discount,
    p_reference_type, p_reference_id, p_idempotency_key, auth.uid()
  ) RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'code_id', c.id,
    'code', c.code,
    'discount_type', c.discount_type,
    'discount_amount', v_discount,
    'remaining_uses', CASE WHEN c.max_uses IS NULL THEN NULL ELSE c.max_uses - COALESCE(c.times_used,0) - 1 END
  );
END $$;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(text, uuid, uuid, numeric, text, uuid, text) TO authenticated;

-- ============================================================================
-- PART B: ATOMIC BENEFIT ADD-ON PURCHASE (re-ordered so credits exist before payment commits)
-- ============================================================================

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
  -- Lock the package
  SELECT * INTO v_pkg FROM public.benefit_packages WHERE id = p_package_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Package not found');
  END IF;

  v_branch_id := COALESCE(p_branch_id, v_pkg.branch_id);
  IF v_branch_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Branch missing');
  END IF;

  v_expires_at := now() + (v_pkg.validity_days || ' days')::interval;

  -- 1) Insert invoice (pending)
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

  -- 2) Insert credits BEFORE settle so failure here aborts whole txn
  BEGIN
    INSERT INTO public.member_benefit_credits (
      member_id, membership_id, benefit_type, package_id,
      credits_total, credits_remaining, expires_at, invoice_id
    ) VALUES (
      p_member_id, p_membership_id, v_pkg.benefit_type, p_package_id,
      v_pkg.quantity, v_pkg.quantity, v_expires_at, v_invoice_id
    ) RETURNING id INTO v_credit_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'benefit_credits_insert_failed: %', SQLERRM;
  END;

  -- 3) Settle payment last; failure raises and rolls back the entire transaction
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
    jsonb_build_object('package_id', p_package_id, 'membership_id', p_membership_id, 'credit_id', v_credit_id)
  );

  IF COALESCE((v_settle_result ->> 'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'settle_payment_failed: %', COALESCE(v_settle_result->>'error','unknown');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'credit_id', v_credit_id,
    'invoice_id', v_invoice_id,
    'amount', v_pkg.price
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.purchase_benefit_credits(uuid, uuid, uuid, uuid, text, text, uuid) TO authenticated;

-- ============================================================================
-- PART C: HRM PAYROLL — shifts, holidays, leave, upgraded compute_payroll
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.staff_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0 = Sunday
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '18:00',
  late_grace_min int NOT NULL DEFAULT 15,
  half_day_threshold_hours numeric NOT NULL DEFAULT 4,
  ot_threshold_hours numeric NOT NULL DEFAULT 8.5,
  ot_multiplier numeric NOT NULL DEFAULT 1.5,
  is_weekly_off boolean NOT NULL DEFAULT false,
  branch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, weekday)
);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_user ON public.staff_shifts(user_id);

CREATE TABLE IF NOT EXISTS public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_paid boolean NOT NULL DEFAULT true,
  pay_multiplier numeric NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (holiday_date, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(holiday_date);

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  leave_type text NOT NULL,    -- 'paid' | 'sick' | 'earned' | 'unpaid' | 'comp_off'
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  reason text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_dates ON public.leave_requests(user_id, start_date, end_date);

ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_shifts' AND policyname='staff_shifts_admin_all') THEN
    CREATE POLICY staff_shifts_admin_all ON public.staff_shifts FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'))
      WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_shifts' AND policyname='staff_shifts_self_read') THEN
    CREATE POLICY staff_shifts_self_read ON public.staff_shifts FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='holidays' AND policyname='holidays_admin_all') THEN
    CREATE POLICY holidays_admin_all ON public.holidays FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'))
      WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='holidays' AND policyname='holidays_read_all') THEN
    CREATE POLICY holidays_read_all ON public.holidays FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leave_requests' AND policyname='leave_admin_all') THEN
    CREATE POLICY leave_admin_all ON public.leave_requests FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'))
      WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leave_requests' AND policyname='leave_self_rw') THEN
    CREATE POLICY leave_self_rw ON public.leave_requests FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Upgraded compute_payroll
CREATE OR REPLACE FUNCTION public.compute_payroll(
  p_user_id uuid,
  p_period_start date,
  p_period_end date,
  p_run_id uuid DEFAULT NULL
) RETURNS TABLE(
  work_date date, status text, hours_worked numeric, ot_hours numeric,
  is_late boolean, is_early_out boolean, is_missing_checkout boolean,
  is_half_day boolean, is_holiday boolean, is_weekly_off boolean,
  leave_type text, payable boolean, notes text
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_d date;
  v_dow int;
  v_shift RECORD;
  v_shift_start time; v_shift_end time;
  v_shift_hours numeric;
  v_grace int;
  v_half_th numeric;
  v_ot_th numeric;
  v_first_in timestamptz;
  v_last_out timestamptz;
  v_total_seconds numeric;
  v_hours numeric;
  v_status text;
  v_late boolean; v_early boolean; v_missing boolean; v_half boolean;
  v_ot numeric; v_holiday boolean; v_weekly_off boolean;
  v_leave text; v_payable boolean; v_notes text;
  v_holiday_mult numeric;
BEGIN
  v_d := p_period_start;
  WHILE v_d <= p_period_end LOOP
    v_dow := EXTRACT(DOW FROM v_d);
    v_late := false; v_early := false; v_missing := false; v_half := false;
    v_ot := 0; v_holiday := false; v_weekly_off := false;
    v_leave := NULL; v_payable := true; v_notes := NULL; v_hours := 0;
    v_holiday_mult := 1.0;

    -- Shift lookup (default 9-18, sun off)
    SELECT * INTO v_shift FROM public.staff_shifts WHERE user_id = p_user_id AND weekday = v_dow LIMIT 1;
    IF FOUND THEN
      v_shift_start := v_shift.start_time;
      v_shift_end := v_shift.end_time;
      v_grace := v_shift.late_grace_min;
      v_half_th := v_shift.half_day_threshold_hours;
      v_ot_th := v_shift.ot_threshold_hours;
      v_weekly_off := v_shift.is_weekly_off;
    ELSE
      v_shift_start := '09:00'::time;
      v_shift_end := '18:00'::time;
      v_grace := 15;
      v_half_th := 4;
      v_ot_th := 8.5;
      v_weekly_off := (v_dow = 0);
    END IF;
    v_shift_hours := EXTRACT(EPOCH FROM (v_shift_end - v_shift_start))/3600.0;

    -- Holiday
    SELECT true, COALESCE(pay_multiplier,1.0) INTO v_holiday, v_holiday_mult
      FROM public.holidays WHERE holiday_date = v_d
        AND (branch_id IS NULL OR branch_id = (SELECT branch_id FROM public.staff_shifts WHERE user_id = p_user_id LIMIT 1))
      LIMIT 1;
    v_holiday := COALESCE(v_holiday, false);

    -- Approved leave
    SELECT leave_type INTO v_leave FROM public.leave_requests
      WHERE user_id = p_user_id AND status='approved' AND v_d BETWEEN start_date AND end_date LIMIT 1;

    -- Sum all attendance intervals for the day (collapse duplicates)
    SELECT MIN(check_in), MAX(COALESCE(check_out, check_in)),
           COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(check_out, check_in) - check_in))), 0)
      INTO v_first_in, v_last_out, v_total_seconds
      FROM public.staff_attendance
     WHERE user_id = p_user_id AND check_in::date = v_d;

    IF v_first_in IS NOT NULL THEN
      v_hours := round(LEAST(v_total_seconds/3600.0, 24), 2);
      IF v_last_out IS NULL OR v_last_out = v_first_in THEN
        v_missing := true;
        v_notes := 'missing_checkout';
      END IF;
      -- Late
      IF EXTRACT(EPOCH FROM (v_first_in::time - v_shift_start))/60.0 > v_grace THEN
        v_late := true;
      END IF;
      -- Early out
      IF NOT v_missing AND v_last_out::time < v_shift_end THEN
        v_early := true;
      END IF;
      -- Half day
      IF v_hours < v_half_th THEN v_half := true; END IF;
      -- OT
      IF v_hours > v_ot_th THEN v_ot := round(v_hours - v_ot_th, 2); END IF;

      v_status := CASE
        WHEN v_missing THEN 'present_missing_out'
        WHEN v_half THEN 'half_day'
        ELSE 'present'
      END;

      -- Holiday work pays multiplier
      IF v_holiday AND v_holiday_mult > 1 THEN
        v_notes := COALESCE(v_notes||'; ','') || format('holiday_pay_x%s', v_holiday_mult);
      END IF;

    ELSIF v_holiday THEN
      v_status := 'holiday'; v_payable := true; v_notes := 'paid_holiday';
    ELSIF v_weekly_off THEN
      v_status := 'weekly_off'; v_payable := true;
    ELSIF v_leave IS NOT NULL THEN
      v_status := 'leave';
      v_payable := (v_leave IN ('paid','sick','earned','comp_off'));
      v_notes := v_leave;
    ELSE
      v_status := 'absent'; v_payable := false;
    END IF;

    work_date := v_d; status := v_status; hours_worked := v_hours; ot_hours := v_ot;
    is_late := v_late; is_early_out := v_early; is_missing_checkout := v_missing;
    is_half_day := v_half; is_holiday := v_holiday; is_weekly_off := v_weekly_off;
    leave_type := v_leave; payable := v_payable; notes := v_notes;
    RETURN NEXT;

    IF p_run_id IS NOT NULL THEN
      INSERT INTO public.payroll_run_lines (
        run_id, user_id, work_date, status, hours_worked, ot_hours,
        is_late, is_early_out, is_missing_checkout, is_half_day,
        is_holiday, is_weekly_off, leave_type, payable, notes
      ) VALUES (
        p_run_id, p_user_id, v_d, v_status, v_hours, v_ot,
        v_late, v_early, v_missing, v_half, v_holiday, v_weekly_off,
        v_leave, v_payable, v_notes
      );
    END IF;

    v_d := v_d + 1;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.compute_payroll(uuid,date,date,uuid) TO authenticated, service_role;

-- ============================================================================
-- PART D: MIPS sync failures + class booking waitlist promotion / no-show reason
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mips_sync_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  entity_type text NOT NULL,    -- 'member' | 'employee' | 'trainer'
  entity_id uuid NOT NULL,
  operation text NOT NULL,      -- 'sync' | 'revoke' | 'verify'
  error_message text,
  payload jsonb,
  status text NOT NULL DEFAULT 'failed',  -- 'failed' | 'retrying' | 'resolved'
  attempts int NOT NULL DEFAULT 1,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mips_sync_failures_status ON public.mips_sync_failures(status, last_attempt_at DESC);

ALTER TABLE public.mips_sync_failures ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mips_sync_failures' AND policyname='mips_failures_admin_all') THEN
    CREATE POLICY mips_failures_admin_all ON public.mips_sync_failures FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'))
      WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'));
  END IF;
END $$;

-- Add no_show_reason + was_waitlisted on class_bookings (additive)
ALTER TABLE public.class_bookings
  ADD COLUMN IF NOT EXISTS no_show_reason text,
  ADD COLUMN IF NOT EXISTS was_waitlisted boolean NOT NULL DEFAULT false;
