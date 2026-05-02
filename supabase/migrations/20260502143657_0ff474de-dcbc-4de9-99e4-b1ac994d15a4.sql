-- ============================================================================
-- PHASE 2: Classes as Benefits — schema + booking logic
-- ============================================================================

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_rate numeric NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS is_gst_inclusive boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS benefit_type_id uuid REFERENCES public.benefit_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requires_benefit boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_classes_benefit_type ON public.classes(benefit_type_id) WHERE benefit_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_classes_paid ON public.classes(is_paid) WHERE is_paid = true;

-- Rewritten validator: Free / Benefit-Quota / Paid-Workshop tri-mode
CREATE OR REPLACE FUNCTION public.validate_class_booking(_class_id uuid, _member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _class RECORD;
  _current_bookings INT;
  _existing_booking RECORD;
  _membership RECORD;
  _benefit RECORD;
  _usage_count INT;
  _bt_code text;
BEGIN
  SELECT * INTO _class FROM classes WHERE id = _class_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Class not found or inactive');
  END IF;

  IF _class.scheduled_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cannot book past classes');
  END IF;

  SELECT * INTO _existing_booking FROM class_bookings
  WHERE class_id = _class_id AND member_id = _member_id AND status = 'booked';
  IF FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Already booked for this class');
  END IF;

  SELECT m.* INTO _membership FROM memberships m
  WHERE m.member_id = _member_id
    AND m.status = 'active'
    AND m.start_date <= CURRENT_DATE
    AND m.end_date >= CURRENT_DATE
  ORDER BY m.end_date DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'No active membership');
  END IF;

  -- Capacity check first (applies to all modes)
  SELECT COUNT(*) INTO _current_bookings FROM class_bookings
  WHERE class_id = _class_id AND status = 'booked';

  IF _current_bookings >= _class.capacity THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Class is full', 'waitlist_available', true);
  END IF;

  -- Mode selection:
  IF _class.benefit_type_id IS NOT NULL THEN
    -- Benefit-linked class: look up the benefit on the member's plan
    SELECT bt.code INTO _bt_code FROM benefit_types bt WHERE bt.id = _class.benefit_type_id;

    SELECT pb.* INTO _benefit FROM plan_benefits pb
    WHERE pb.plan_id = _membership.plan_id
      AND pb.benefit_type_id = _class.benefit_type_id
    LIMIT 1;

    IF NOT FOUND THEN
      -- Member doesn't have this benefit
      IF _class.requires_benefit AND NOT _class.is_paid THEN
        RETURN jsonb_build_object('valid', false, 'error', 'This class requires a plan that includes ' || COALESCE(_bt_code, 'this benefit'));
      END IF;
      IF _class.is_paid THEN
        RETURN jsonb_build_object('valid', true, 'membership_id', _membership.id, 'mode', 'paid', 'price', _class.price);
      END IF;
      -- Not required, not paid → free
      RETURN jsonb_build_object('valid', true, 'membership_id', _membership.id, 'mode', 'free');
    END IF;

    -- Has benefit — check quota
    IF _benefit.limit_count IS NOT NULL AND _benefit.frequency <> 'unlimited' THEN
      SELECT COALESCE(SUM(bu.usage_count), 0) INTO _usage_count
      FROM benefit_usage bu
      WHERE bu.membership_id = _membership.id
        AND bu.benefit_type_id = _class.benefit_type_id
        AND (
          (_benefit.frequency = 'daily' AND bu.usage_date = CURRENT_DATE) OR
          (_benefit.frequency = 'weekly' AND bu.usage_date >= date_trunc('week', CURRENT_DATE)::date) OR
          (_benefit.frequency = 'monthly' AND bu.usage_date >= date_trunc('month', CURRENT_DATE)::date) OR
          (_benefit.frequency = 'per_membership')
        );

      IF _usage_count >= _benefit.limit_count THEN
        IF _class.is_paid THEN
          RETURN jsonb_build_object('valid', true, 'membership_id', _membership.id, 'mode', 'paid', 'price', _class.price, 'note', 'Benefit quota exhausted, charging workshop fee');
        END IF;
        RETURN jsonb_build_object('valid', false, 'error', 'Class booking limit reached for this period', 'limit', _benefit.limit_count, 'used', _usage_count);
      END IF;
    END IF;

    RETURN jsonb_build_object('valid', true, 'membership_id', _membership.id, 'mode', 'benefit', 'benefit_type_id', _class.benefit_type_id);
  END IF;

  -- No benefit linked
  IF _class.is_paid THEN
    RETURN jsonb_build_object('valid', true, 'membership_id', _membership.id, 'mode', 'paid', 'price', _class.price);
  END IF;

  -- Free for everyone
  RETURN jsonb_build_object('valid', true, 'membership_id', _membership.id, 'mode', 'free');
END;
$function$;

-- Rewritten book_class: records benefit usage or creates invoice depending on mode
CREATE OR REPLACE FUNCTION public.book_class(_class_id uuid, _member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _validation jsonb;
  _booking_id uuid;
  _mode text;
  _class RECORD;
  _membership_id uuid;
  _invoice_result jsonb;
  _invoice_id uuid;
BEGIN
  _validation := validate_class_booking(_class_id, _member_id);
  IF NOT (_validation->>'valid')::boolean THEN
    RETURN _validation;
  END IF;

  _mode := COALESCE(_validation->>'mode', 'free');
  _membership_id := (_validation->>'membership_id')::uuid;
  SELECT * INTO _class FROM classes WHERE id = _class_id;

  -- Paid workshop: create invoice first
  IF _mode = 'paid' AND _class.price > 0 THEN
    _invoice_result := public.create_manual_invoice(
      p_branch_id => _class.branch_id,
      p_member_id => _member_id,
      p_items => jsonb_build_array(jsonb_build_object(
        'description', 'Class: ' || _class.name,
        'quantity', 1,
        'unit_price', _class.price,
        'reference_type', 'class_booking',
        'reference_id', _class_id::text
      )),
      p_due_date => CURRENT_DATE + INTERVAL '7 days',
      p_notes => 'Workshop / paid class booking',
      p_discount_amount => 0,
      p_include_gst => COALESCE(_class.gst_rate, 0) > 0,
      p_gst_rate => COALESCE(_class.gst_rate, 0),
      p_customer_gstin => NULL,
      p_gst_inclusive => COALESCE(_class.is_gst_inclusive, true)
    );
    IF NOT COALESCE((_invoice_result->>'success')::boolean, false) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Failed to create invoice for paid class');
    END IF;
    _invoice_id := (_invoice_result->>'invoice_id')::uuid;
  END IF;

  -- Create booking
  INSERT INTO class_bookings (class_id, member_id, status)
  VALUES (_class_id, _member_id, 'booked')
  RETURNING id INTO _booking_id;

  -- Benefit mode: record usage (only if quota was not already exhausted, i.e. mode='benefit')
  IF _mode = 'benefit' AND _class.benefit_type_id IS NOT NULL THEN
    INSERT INTO benefit_usage (membership_id, benefit_type, benefit_type_id, usage_date, usage_count, notes, recorded_by)
    VALUES (_membership_id, 'group_classes', _class.benefit_type_id, CURRENT_DATE, 1, 'Class: ' || _class.name, auth.uid());
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', _booking_id,
    'mode', _mode,
    'invoice_id', _invoice_id
  );
END;
$function$;


-- ============================================================================
-- PHASE 3: Lockers unified through Benefits
-- ============================================================================

-- Seed locker_access benefit_type for every branch (idempotent)
INSERT INTO public.benefit_types (branch_id, name, code, description, icon, is_bookable, is_active, category, default_duration_minutes)
SELECT b.id, 'Locker Access', 'locker_access', 'Personal locker assignment included with the plan', 'Lock', false, true, 'amenity', 0
FROM public.branches b
WHERE NOT EXISTS (
  SELECT 1 FROM public.benefit_types bt WHERE bt.branch_id = b.id AND bt.code = 'locker_access'
);

-- Backfill plan_benefits: every plan with includes_free_locker=true gets a locker_access benefit row
INSERT INTO public.plan_benefits (plan_id, benefit_type, benefit_type_id, frequency, limit_count, description, reset_period)
SELECT
  mp.id,
  'locker'::public.benefit_type,
  bt.id,
  'per_membership'::public.frequency_type,
  1,
  'Includes ' || COALESCE(mp.free_locker_size, 'standard') || ' locker',
  'per_membership'
FROM public.membership_plans mp
JOIN public.benefit_types bt
  ON bt.code = 'locker_access'
 AND bt.branch_id = COALESCE(mp.branch_id, bt.branch_id)
WHERE COALESCE(mp.includes_free_locker, false) = true
  AND mp.branch_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.plan_benefits pb
    WHERE pb.plan_id = mp.id AND pb.benefit_type_id = bt.id
  );

-- Update assign_locker_with_billing to accept p_assign_source
CREATE OR REPLACE FUNCTION public.assign_locker_with_billing(
  p_locker_id uuid,
  p_member_id uuid,
  p_start_date date,
  p_end_date date,
  p_fee_amount numeric,
  p_billing_months integer DEFAULT 1,
  p_chargeable boolean DEFAULT true,
  p_gst_rate numeric DEFAULT NULL::numeric,
  p_received_by uuid DEFAULT NULL::uuid,
  p_assign_source text DEFAULT 'addon'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_locker record;
  v_assignment_id uuid;
  v_invoice_id uuid := NULL;
  v_invoice_item_id uuid;
  v_branch_id uuid;
  v_total numeric;
  v_gst_rate numeric;
  v_gst record;
  v_effective_end_date date;
  v_membership_end date;
  v_chargeable boolean;
BEGIN
  SELECT * INTO v_locker FROM public.lockers WHERE id = p_locker_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LOCKER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_locker.status <> 'available' THEN
    RAISE EXCEPTION 'LOCKER_TAKEN: locker % is %', v_locker.locker_number, v_locker.status USING ERRCODE = 'P0001';
  END IF;
  v_branch_id := v_locker.branch_id;

  v_effective_end_date := p_end_date;
  v_chargeable := p_chargeable;

  -- Plan source: pull membership end_date and disable charging
  IF p_assign_source = 'plan' THEN
    SELECT m.end_date INTO v_membership_end
    FROM public.memberships m
    WHERE m.member_id = p_member_id
      AND m.status = 'active'
      AND m.end_date >= p_start_date
    ORDER BY m.end_date DESC LIMIT 1;

    IF v_membership_end IS NOT NULL THEN
      v_effective_end_date := v_membership_end;
    END IF;
    v_chargeable := false;
  END IF;

  INSERT INTO public.locker_assignments (locker_id, member_id, start_date, end_date, fee_amount, is_active)
  VALUES (p_locker_id, p_member_id, p_start_date, v_effective_end_date,
          CASE WHEN v_chargeable THEN p_fee_amount ELSE 0 END, true)
  RETURNING id INTO v_assignment_id;

  UPDATE public.lockers SET status = 'occupied', updated_at = now() WHERE id = p_locker_id;

  IF v_chargeable AND COALESCE(p_fee_amount,0) > 0 THEN
    v_total := round(p_fee_amount * COALESCE(p_billing_months,1), 2);
    v_gst_rate := COALESCE(p_gst_rate, public.resolve_gst_rate('locker', p_locker_id, v_branch_id));
    SELECT * INTO v_gst FROM public.calc_gst(v_total, v_gst_rate, false, true);

    INSERT INTO public.invoices (
      member_id, branch_id, total_amount, amount_paid, status, payment_method, due_date, created_by
    ) VALUES (
      p_member_id, v_branch_id, v_gst.total, 0, 'pending', NULL, v_effective_end_date, p_received_by
    ) RETURNING id INTO v_invoice_id;

    INSERT INTO public.invoice_items (
      invoice_id, item_type, item_name, quantity, unit_price, tax_rate, tax_amount, total_amount
    ) VALUES (
      v_invoice_id, 'locker',
      'Locker ' || v_locker.locker_number || ' (' || COALESCE(p_billing_months,1) || ' month' || CASE WHEN COALESCE(p_billing_months,1)>1 THEN 's' ELSE '' END || ')',
      1, v_gst.taxable, v_gst_rate, v_gst.cgst + v_gst.sgst + v_gst.igst, v_gst.total
    ) RETURNING id INTO v_invoice_item_id;
  END IF;

  RETURN jsonb_build_object(
    'assignment_id', v_assignment_id,
    'invoice_id', v_invoice_id,
    'locker_id', p_locker_id,
    'branch_id', v_branch_id,
    'source', p_assign_source,
    'end_date', v_effective_end_date
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM public.log_error_event('error','database', SQLERRM, 'assign_locker_with_billing', NULL,'lockers', v_branch_id, p_received_by, NULL, NULL, NULL,
    jsonb_build_object('locker_id', p_locker_id, 'member_id', p_member_id, 'source', p_assign_source));
  RAISE;
END;
$function$;


-- ============================================================================
-- PHASE 4: Group / Couple Discounts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.member_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  group_type text NOT NULL DEFAULT 'friends' CHECK (group_type IN ('couple','family','corporate','friends')),
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage','fixed')),
  discount_value numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.member_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.member_groups(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_member_groups_branch ON public.member_groups(branch_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_member_group_members_member ON public.member_group_members(member_id);
CREATE INDEX IF NOT EXISTS idx_member_group_members_group ON public.member_group_members(group_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_member_groups_updated_at ON public.member_groups;
CREATE TRIGGER update_member_groups_updated_at
  BEFORE UPDATE ON public.member_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.member_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_group_members ENABLE ROW LEVEL SECURITY;

-- RLS: Staff can manage groups in their branch; members can view groups they belong to.
DROP POLICY IF EXISTS "Staff manage member_groups" ON public.member_groups;
CREATE POLICY "Staff manage member_groups" ON public.member_groups
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role, 'staff'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role, 'staff'::app_role]));

DROP POLICY IF EXISTS "Members view own groups" ON public.member_groups;
CREATE POLICY "Members view own groups" ON public.member_groups
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.member_group_members mgm
      JOIN public.members m ON m.id = mgm.member_id
      WHERE mgm.group_id = member_groups.id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff manage member_group_members" ON public.member_group_members;
CREATE POLICY "Staff manage member_group_members" ON public.member_group_members
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role, 'staff'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role, 'staff'::app_role]));

DROP POLICY IF EXISTS "Members view own group memberships" ON public.member_group_members;
CREATE POLICY "Members view own group memberships" ON public.member_group_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_group_members.member_id AND m.user_id = auth.uid())
  );

-- Atomic group purchase: same plan for N members, group discount split evenly across each invoice.
CREATE OR REPLACE FUNCTION public.purchase_group_membership(
  p_branch_id uuid,
  p_member_ids uuid[],
  p_plan_id uuid,
  p_start_date date,
  p_group_name text,
  p_group_type text DEFAULT 'friends',
  p_discount_type text DEFAULT 'percentage',
  p_discount_value numeric DEFAULT 0,
  p_payment_method text DEFAULT 'cash',
  p_include_gst boolean DEFAULT false,
  p_notes text DEFAULT NULL,
  p_received_by uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan public.membership_plans%ROWTYPE;
  v_member_id uuid;
  v_group_id uuid;
  v_results jsonb := '[]'::jsonb;
  v_member_count int;
  v_base_price numeric;
  v_admission numeric;
  v_gross_per_member numeric;
  v_discount_per_member numeric;
  v_purchase_result jsonb;
  v_idempotency_key text;
BEGIN
  IF p_member_ids IS NULL OR array_length(p_member_ids, 1) IS NULL OR array_length(p_member_ids, 1) < 2 THEN
    RAISE EXCEPTION 'GROUP_REQUIRES_MIN_2_MEMBERS' USING ERRCODE = '22023';
  END IF;
  IF p_group_type NOT IN ('couple','family','corporate','friends') THEN
    RAISE EXCEPTION 'INVALID_GROUP_TYPE' USING ERRCODE = '22023';
  END IF;

  v_member_count := array_length(p_member_ids, 1);

  SELECT * INTO v_plan FROM public.membership_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  v_base_price := COALESCE(v_plan.discounted_price, v_plan.price, 0);
  v_admission := COALESCE(v_plan.admission_fee, 0);
  v_gross_per_member := v_base_price + v_admission;

  -- Compute per-member discount (split evenly)
  IF p_discount_type = 'percentage' THEN
    v_discount_per_member := round(v_gross_per_member * COALESCE(p_discount_value,0) / 100.0, 2);
  ELSE
    -- Fixed: total discount divided across members
    v_discount_per_member := round(COALESCE(p_discount_value,0) / v_member_count, 2);
  END IF;
  v_discount_per_member := GREATEST(0, LEAST(v_discount_per_member, v_gross_per_member));

  -- Create the group
  INSERT INTO public.member_groups (branch_id, group_name, group_type, discount_type, discount_value, notes, created_by)
  VALUES (p_branch_id, p_group_name, p_group_type, p_discount_type, COALESCE(p_discount_value,0), p_notes, p_received_by)
  RETURNING id INTO v_group_id;

  -- Add members + purchase plan for each
  FOREACH v_member_id IN ARRAY p_member_ids LOOP
    INSERT INTO public.member_group_members (group_id, member_id, role)
    VALUES (v_group_id, v_member_id, 'member')
    ON CONFLICT DO NOTHING;

    v_idempotency_key := format('group_purchase:%s:%s:%s', v_group_id, v_member_id, p_plan_id);

    v_purchase_result := public.purchase_member_membership(
      p_member_id => v_member_id,
      p_plan_id => p_plan_id,
      p_branch_id => p_branch_id,
      p_start_date => p_start_date,
      p_discount_amount => v_discount_per_member,
      p_discount_reason => format('Group: %s (%s)', p_group_name, p_group_type),
      p_include_gst => p_include_gst,
      p_gst_rate => COALESCE(v_plan.gst_rate, 0),
      p_payment_method => p_payment_method,
      p_amount_paying => 0,  -- group purchases create pending invoices; settle individually
      p_payment_due_date => p_start_date + INTERVAL '7 days',
      p_send_reminders => true,
      p_payment_source => 'manual',
      p_idempotency_key => v_idempotency_key,
      p_assign_locker_id => NULL,
      p_notes => p_notes,
      p_received_by => p_received_by
    );

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'member_id', v_member_id,
      'result', v_purchase_result
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'group_id', v_group_id,
    'group_name', p_group_name,
    'member_count', v_member_count,
    'discount_per_member', v_discount_per_member,
    'discount_total', v_discount_per_member * v_member_count,
    'purchases', v_results
  );
END;
$function$;