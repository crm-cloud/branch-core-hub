-- ============================================================================
-- PRODUCTION HARDENING — Phase 1 + Phase 2
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helpers / extensions
-- ---------------------------------------------------------------------------
-- (uuid + crypto already present)

-- ---------------------------------------------------------------------------
-- 1. APPROVAL AUDIT LOG  (Phase 1 §1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.approval_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  action text NOT NULL,                    -- 'approved' | 'rejected' | 'failed'
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  success boolean NOT NULL,
  error_message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_approval_audit_log_request ON public.approval_audit_log(request_id, created_at DESC);

ALTER TABLE public.approval_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View approval audit" ON public.approval_audit_log;
CREATE POLICY "View approval audit"
ON public.approval_audit_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.approval_requests ar
    WHERE ar.id = approval_audit_log.request_id
      AND (manages_branch(auth.uid(), ar.branch_id)
           OR has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]))
  )
);

DROP POLICY IF EXISTS "Insert approval audit (definer-only)" ON public.approval_audit_log;
-- Audit rows are written exclusively by SECURITY DEFINER functions; deny client inserts.

-- ---------------------------------------------------------------------------
-- 2. process_approval_request RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_approval_request(
  p_request_id uuid,
  p_decision text,                  -- 'approve' | 'reject'
  p_review_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req         public.approval_requests%ROWTYPE;
  _data        jsonb;
  _membership_id uuid;
  _to_member_id uuid;
  _to_branch_id uuid;
  _ms          public.memberships%ROWTYPE;
  _frozen_days int;
  _today       date := CURRENT_DATE;
  _err         text;
  _new_membership_id uuid;
  _invoice_id  uuid;
  _audit_payload jsonb;
BEGIN
  -- Authorization: caller must manage the branch
  IF NOT has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role]) THEN
    RAISE EXCEPTION 'Not authorized to process approvals';
  END IF;

  IF p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'p_decision must be approve or reject';
  END IF;

  -- Lock the request to prevent double-processing
  SELECT * INTO _req
  FROM public.approval_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval request not found';
  END IF;

  IF _req.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request already ' || _req.status);
  END IF;

  -- Confirm caller manages the request's branch
  IF NOT manages_branch(auth.uid(), _req.branch_id) THEN
    RAISE EXCEPTION 'Not authorized for this branch';
  END IF;

  _data := _req.request_data;

  -- ─── REJECTION PATH ─────────────────────────────────────────
  IF p_decision = 'reject' THEN
    UPDATE public.approval_requests
    SET status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_notes = p_review_notes
    WHERE id = p_request_id;

    -- Side-effect cleanup for rejected freeze
    IF _req.approval_type = 'membership_freeze' AND _req.reference_type <> 'membership_unfreeze' THEN
      UPDATE public.membership_freeze_history
      SET status = 'rejected'
      WHERE id = _req.reference_id;
    END IF;

    INSERT INTO public.approval_audit_log(request_id, action, actor_id, success, payload)
    VALUES (p_request_id, 'rejected', auth.uid(), true,
            jsonb_build_object('notes', p_review_notes));
    RETURN jsonb_build_object('success', true, 'status', 'rejected');
  END IF;

  -- ─── APPROVAL PATH — execute side-effect FIRST ──────────────
  _membership_id := COALESCE((_data->>'membershipId')::uuid, (_data->>'membership_id')::uuid);
  _to_member_id  := (_data->>'to_member_id')::uuid;
  _to_branch_id  := (_data->>'to_branch_id')::uuid;
  _audit_payload := _data;

  BEGIN
    IF _req.approval_type = 'membership_freeze' AND _req.reference_type <> 'membership_unfreeze' THEN
      -- Freeze
      UPDATE public.membership_freeze_history
      SET status = 'approved', approved_by = auth.uid(), approved_at = now()
      WHERE id = _req.reference_id;
      IF _membership_id IS NOT NULL THEN
        UPDATE public.memberships SET status = 'frozen' WHERE id = _membership_id;
      END IF;

    ELSIF _req.reference_type = 'membership_unfreeze' THEN
      -- Resume: extend by total approved frozen days
      IF _membership_id IS NOT NULL THEN
        SELECT * INTO _ms FROM public.memberships WHERE id = _membership_id FOR UPDATE;
        IF FOUND THEN
          SELECT COALESCE(SUM(
            GREATEST(0, (COALESCE(end_date, _today) - start_date)::int)
          ), 0)
          INTO _frozen_days
          FROM public.membership_freeze_history
          WHERE membership_id = _membership_id AND status = 'approved';

          UPDATE public.memberships
          SET status = 'active',
              end_date = (_ms.end_date + _frozen_days)
          WHERE id = _membership_id;
        END IF;
      END IF;

    ELSIF _req.reference_type = 'trainer_change' THEN
      IF (_data->>'memberId') IS NOT NULL AND (_data->>'newTrainerId') IS NOT NULL THEN
        UPDATE public.members
        SET assigned_trainer_id = (_data->>'newTrainerId')::uuid
        WHERE id = (_data->>'memberId')::uuid;
      END IF;

    ELSIF _req.approval_type = 'membership_transfer' THEN
      IF _to_member_id IS NOT NULL AND _membership_id IS NOT NULL THEN
        SELECT * INTO _ms FROM public.memberships WHERE id = _membership_id FOR UPDATE;
        IF FOUND THEN
          DECLARE _remaining int;
          BEGIN
            _remaining := GREATEST(0, (_ms.end_date - _today)::int);
            UPDATE public.memberships
            SET status = 'transferred', end_date = _today
            WHERE id = _membership_id;

            INSERT INTO public.memberships
              (member_id, plan_id, branch_id, start_date, end_date, original_end_date, price_paid, status)
            VALUES (
              _to_member_id,
              COALESCE((_data->>'plan_id')::uuid, _ms.plan_id),
              COALESCE((_data->>'branch_id')::uuid, _req.branch_id),
              _today, _today + _remaining, _today + _remaining, 0, 'active'
            )
            RETURNING id INTO _new_membership_id;
          END;
        END IF;

        IF COALESCE((_data->>'is_chargeable')::boolean, false)
           AND COALESCE((_data->>'transfer_fee')::numeric, 0) > 0 THEN
          INSERT INTO public.invoices
            (branch_id, member_id, subtotal, total_amount, amount_paid, status, due_date, invoice_type)
          VALUES (_req.branch_id, _to_member_id,
                  (_data->>'transfer_fee')::numeric,
                  (_data->>'transfer_fee')::numeric,
                  0, 'pending', _today, 'membership_transfer')
          RETURNING id INTO _invoice_id;
          INSERT INTO public.invoice_items
            (invoice_id, description, unit_price, quantity, total_amount, reference_type, reference_id)
          VALUES (_invoice_id,
                  'Membership Transfer Fee from ' || COALESCE(_data->>'from_member_name', 'member'),
                  (_data->>'transfer_fee')::numeric, 1,
                  (_data->>'transfer_fee')::numeric,
                  'membership_transfer', _membership_id);
        END IF;
      END IF;

    ELSIF _req.approval_type = 'branch_transfer' THEN
      DECLARE _mid uuid := COALESCE((_data->>'member_id')::uuid, _req.reference_id);
      BEGIN
        IF _mid IS NOT NULL AND _to_branch_id IS NOT NULL THEN
          UPDATE public.members SET branch_id = _to_branch_id WHERE id = _mid;
          UPDATE public.memberships
          SET branch_id = _to_branch_id
          WHERE member_id = _mid AND status IN ('active', 'frozen');
        END IF;
      END;

    ELSIF _req.approval_type = 'comp_gift' THEN
      IF _req.reference_type = 'extend_days' AND _membership_id IS NOT NULL
         AND COALESCE((_data->>'days')::int, 0) > 0 THEN
        UPDATE public.memberships
        SET end_date = end_date + (_data->>'days')::int
        WHERE id = _membership_id;
      ELSIF _req.reference_type = 'comp_sessions' THEN
        INSERT INTO public.member_comps
          (member_id, membership_id, benefit_type_id, comp_sessions, used_sessions, reason, granted_by)
        VALUES (
          (_data->>'memberId')::uuid,
          NULLIF(_data->>'membershipId','')::uuid,
          (_data->>'benefitTypeId')::uuid,
          COALESCE((_data->>'sessions')::int, 0),
          0,
          COALESCE(_data->>'reason', 'Approved comp'),
          auth.uid()
        );
      END IF;
    END IF;

    -- All side-effects succeeded — finalize approval
    UPDATE public.approval_requests
    SET status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_notes = p_review_notes
    WHERE id = p_request_id;

    INSERT INTO public.approval_audit_log(request_id, action, actor_id, success, payload)
    VALUES (p_request_id, 'approved', auth.uid(), true, _audit_payload);

    RETURN jsonb_build_object('success', true, 'status', 'approved',
                              'new_membership_id', _new_membership_id,
                              'invoice_id', _invoice_id);

  EXCEPTION WHEN OTHERS THEN
    _err := SQLERRM;
    -- Rollback nested side-effects via re-raise after audit
    INSERT INTO public.approval_audit_log(request_id, action, actor_id, success, error_message, payload)
    VALUES (p_request_id, 'failed', auth.uid(), false, _err, _audit_payload);
    RAISE EXCEPTION 'Approval execution failed: %', _err;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_approval_request(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. purchase_benefit_topup RPC  (Phase 1 §3)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purchase_benefit_topup(
  p_member_id uuid,
  p_membership_id uuid,
  p_benefit_type_id uuid,
  p_credits int,
  p_unit_price numeric,
  p_gst_rate numeric DEFAULT 0,
  p_payment_method text DEFAULT 'cash',
  p_branch_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_received_by uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _btype       record;
  _branch_id   uuid;
  _subtotal    numeric;
  _tax_amount  numeric;
  _total       numeric;
  _invoice_id  uuid;
  _grant_id    uuid;
  _settle      jsonb;
  _existing    record;
  _benefit_enum benefit_type;
BEGIN
  IF NOT has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role, 'staff'::app_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_credits <= 0 THEN RAISE EXCEPTION 'credits must be > 0'; END IF;
  IF p_unit_price < 0 THEN RAISE EXCEPTION 'unit_price must be >= 0'; END IF;

  -- Idempotency: if a grant already exists for this key, return it
  IF p_idempotency_key IS NOT NULL THEN
    SELECT mbc.id AS grant_id, mbc.invoice_id
    INTO _existing
    FROM public.member_benefit_credits mbc
    WHERE mbc.invoice_id IN (
      SELECT id FROM public.invoices WHERE notes LIKE '%idempotency:' || p_idempotency_key || '%'
    )
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true,
                                'grant_id', _existing.grant_id,
                                'invoice_id', _existing.invoice_id);
    END IF;
  END IF;

  SELECT id, name, branch_id, COALESCE(internal_code, 'other') AS code
  INTO _btype FROM public.benefit_types WHERE id = p_benefit_type_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Benefit type not found'; END IF;

  _branch_id := COALESCE(p_branch_id, _btype.branch_id);
  IF _branch_id IS NULL THEN
    SELECT branch_id INTO _branch_id FROM public.members WHERE id = p_member_id;
  END IF;

  -- Map internal_code text to benefit_type enum (fallback to 'other')
  BEGIN
    _benefit_enum := _btype.code::benefit_type;
  EXCEPTION WHEN OTHERS THEN
    _benefit_enum := 'other'::benefit_type;
  END;

  _subtotal   := ROUND(p_unit_price * p_credits, 2);
  _tax_amount := ROUND(_subtotal * COALESCE(p_gst_rate, 0) / 100.0, 2);
  _total      := _subtotal + _tax_amount;

  -- 1. Invoice (paid status set after record_payment)
  INSERT INTO public.invoices
    (branch_id, member_id, subtotal, tax_amount, total_amount, amount_paid,
     status, due_date, invoice_type, is_gst_invoice, gst_rate,
     source, notes, created_by)
  VALUES (
    _branch_id, p_member_id, _subtotal, _tax_amount, _total, 0,
    'pending', CURRENT_DATE, 'benefit_topup',
    COALESCE(p_gst_rate, 0) > 0, COALESCE(p_gst_rate, 0),
    'manual',
    CASE WHEN p_idempotency_key IS NOT NULL
         THEN 'Top-up: ' || p_credits || 'x ' || _btype.name || ' [idempotency:' || p_idempotency_key || ']'
         ELSE 'Top-up: ' || p_credits || 'x ' || _btype.name END,
    auth.uid()
  )
  RETURNING id INTO _invoice_id;

  INSERT INTO public.invoice_items
    (invoice_id, description, quantity, unit_price, tax_rate, tax_amount, total_amount,
     reference_type, reference_id, hsn_code)
  VALUES (
    _invoice_id,
    _btype.name || ' Top-Up (' || p_credits || ' sessions)',
    p_credits, p_unit_price,
    COALESCE(p_gst_rate, 0), _tax_amount, _total,
    'benefit_topup', p_benefit_type_id,
    '999723'  -- HSN/SAC: other recreational services
  );

  -- 2. Settle via unified payment authority
  IF p_payment_method IS NOT NULL AND _total > 0 THEN
    SELECT public.record_payment(
      p_branch_id := _branch_id,
      p_invoice_id := _invoice_id,
      p_member_id := p_member_id,
      p_amount := _total,
      p_payment_method := p_payment_method,
      p_transaction_id := NULL,
      p_notes := COALESCE('Benefit top-up settlement', ''),
      p_received_by := p_received_by,
      p_income_category_id := NULL
    ) INTO _settle;
    IF NOT COALESCE((_settle->>'success')::boolean, false) THEN
      RAISE EXCEPTION 'Payment failed: %', COALESCE(_settle->>'error', 'unknown');
    END IF;
  END IF;

  -- 3. Grant credits (60-day default expiry, can be overridden later)
  INSERT INTO public.member_benefit_credits
    (member_id, membership_id, benefit_type, benefit_type_id,
     credits_total, credits_remaining, invoice_id, expires_at)
  VALUES (
    p_member_id, p_membership_id, _benefit_enum, p_benefit_type_id,
    p_credits, p_credits, _invoice_id, now() + interval '60 days'
  )
  RETURNING id INTO _grant_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', _invoice_id,
    'grant_id', _grant_id,
    'subtotal', _subtotal,
    'tax_amount', _tax_amount,
    'total', _total,
    'settlement', _settle
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_benefit_topup(uuid, uuid, uuid, int, numeric, numeric, text, uuid, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. convert_referral RPC  (Phase 1 §5)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_referral(
  p_referral_id uuid,
  p_referred_member_id uuid,
  p_referrer_reward_type text DEFAULT NULL,
  p_referrer_reward_value numeric DEFAULT 0,
  p_referred_reward_type text DEFAULT NULL,
  p_referred_reward_value numeric DEFAULT 0,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ref       public.referrals%ROWTYPE;
  _existing  uuid[];
  _ref_reward_id uuid;
  _new_reward_id uuid;
  _reward_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF NOT has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role, 'staff'::app_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _ref FROM public.referrals WHERE id = p_referral_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Referral not found'; END IF;

  -- Idempotency: already converted -> return existing rewards
  IF _ref.status = 'converted' AND _ref.referred_member_id = p_referred_member_id THEN
    SELECT array_agg(id) INTO _existing
    FROM public.referral_rewards WHERE referral_id = p_referral_id;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'reward_ids', COALESCE(_existing, ARRAY[]::uuid[]));
  END IF;

  IF _ref.status = 'converted' AND _ref.referred_member_id IS DISTINCT FROM p_referred_member_id THEN
    RAISE EXCEPTION 'Referral already converted with a different member';
  END IF;

  -- Issue rewards
  IF p_referrer_reward_value > 0 AND _ref.referrer_member_id IS NOT NULL THEN
    INSERT INTO public.referral_rewards
      (referral_id, member_id, reward_type, reward_value, description, is_claimed, claim_idempotency_key)
    VALUES (
      p_referral_id, _ref.referrer_member_id,
      COALESCE(p_referrer_reward_type, 'wallet_credit'),
      p_referrer_reward_value,
      'Referral bonus for referring ' || COALESCE(_ref.referred_name, 'a member'),
      false,
      CASE WHEN p_idempotency_key IS NOT NULL THEN 'referrer:' || p_idempotency_key ELSE NULL END
    )
    RETURNING id INTO _new_reward_id;
    _reward_ids := _reward_ids || _new_reward_id;
  END IF;

  IF p_referred_reward_value > 0 THEN
    INSERT INTO public.referral_rewards
      (referral_id, member_id, reward_type, reward_value, description, is_claimed, claim_idempotency_key)
    VALUES (
      p_referral_id, p_referred_member_id,
      COALESCE(p_referred_reward_type, 'wallet_credit'),
      p_referred_reward_value,
      'Welcome bonus for joining via referral',
      false,
      CASE WHEN p_idempotency_key IS NOT NULL THEN 'referred:' || p_idempotency_key ELSE NULL END
    )
    RETURNING id INTO _new_reward_id;
    _reward_ids := _reward_ids || _new_reward_id;
  END IF;

  -- Transition status
  UPDATE public.referrals
  SET status = 'converted',
      lifecycle_status = 'converted',
      referred_member_id = p_referred_member_id,
      converted_at = now(),
      last_status_change_at = now()
  WHERE id = p_referral_id;

  RETURN jsonb_build_object('success', true, 'reward_ids', _reward_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_referral(uuid, uuid, text, numeric, text, numeric, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. STAFF ATTENDANCE — race-safe  (Phase 2 §6)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS staff_attendance_one_active_per_user
ON public.staff_attendance(user_id)
WHERE check_out IS NULL;

CREATE OR REPLACE FUNCTION public.staff_check_in(
  p_user_id uuid,
  p_branch_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_user_id <> auth.uid()
     AND NOT has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  BEGIN
    INSERT INTO public.staff_attendance(user_id, branch_id, notes)
    VALUES (p_user_id, p_branch_id, p_notes)
    RETURNING id INTO _id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO _id
    FROM public.staff_attendance
    WHERE user_id = p_user_id AND check_out IS NULL
    LIMIT 1;
    RETURN jsonb_build_object('success', false, 'message', 'Already checked in', 'attendance_id', _id);
  END;

  RETURN jsonb_build_object('success', true, 'attendance_id', _id, 'message', 'Check-in successful');
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_check_out(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.staff_attendance%ROWTYPE;
  _now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_user_id <> auth.uid()
     AND NOT has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _row
  FROM public.staff_attendance
  WHERE user_id = p_user_id AND check_out IS NULL
  ORDER BY check_in DESC LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'No active check-in');
  END IF;

  UPDATE public.staff_attendance SET check_out = _now WHERE id = _row.id;

  RETURN jsonb_build_object(
    'success', true,
    'attendance_id', _row.id,
    'check_in', _row.check_in,
    'check_out', _now,
    'duration_minutes', EXTRACT(EPOCH FROM (_now - _row.check_in))/60
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_check_in(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_check_out(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. COUPON REDEMPTIONS  (Phase 2 §7)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id uuid NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  order_total numeric(10,2) NOT NULL,
  discount_applied numeric(10,2) NOT NULL,
  idempotency_key text,
  released_at timestamptz,
  release_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_redemptions_idem
ON public.coupon_redemptions(discount_code_id, idempotency_key)
WHERE idempotency_key IS NOT NULL AND released_at IS NULL;

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage redemptions" ON public.coupon_redemptions;
CREATE POLICY "Staff manage redemptions"
ON public.coupon_redemptions FOR ALL TO authenticated
USING (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role,'staff'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role,'staff'::app_role]));

DROP POLICY IF EXISTS "Members view own redemptions" ON public.coupon_redemptions;
CREATE POLICY "Members view own redemptions"
ON public.coupon_redemptions FOR SELECT TO authenticated
USING (member_id = get_member_id(auth.uid()));

CREATE OR REPLACE FUNCTION public.consume_coupon(
  p_code text,
  p_member_id uuid,
  p_order_total numeric,
  p_branch_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _coupon public.discount_codes%ROWTYPE;
  _existing public.coupon_redemptions%ROWTYPE;
  _discount numeric;
  _redemption_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Idempotency replay
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO _existing
    FROM public.coupon_redemptions
    WHERE idempotency_key = p_idempotency_key AND released_at IS NULL
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true,
                                'redemption_id', _existing.id,
                                'discount', _existing.discount_applied);
    END IF;
  END IF;

  SELECT * INTO _coupon FROM public.discount_codes
  WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Coupon not found'; END IF;
  IF NOT _coupon.is_active THEN RAISE EXCEPTION 'Coupon inactive'; END IF;
  IF _coupon.valid_from IS NOT NULL AND CURRENT_DATE < _coupon.valid_from THEN
    RAISE EXCEPTION 'Coupon not yet valid';
  END IF;
  IF _coupon.valid_until IS NOT NULL AND CURRENT_DATE > _coupon.valid_until THEN
    RAISE EXCEPTION 'Coupon expired';
  END IF;
  IF _coupon.max_uses IS NOT NULL AND COALESCE(_coupon.times_used, 0) >= _coupon.max_uses THEN
    RAISE EXCEPTION 'Coupon usage limit reached';
  END IF;
  IF COALESCE(_coupon.min_purchase, 0) > p_order_total THEN
    RAISE EXCEPTION 'Order below coupon minimum (₹%)', _coupon.min_purchase;
  END IF;

  IF _coupon.discount_type = 'percentage' THEN
    _discount := ROUND(p_order_total * _coupon.discount_value / 100.0, 2);
  ELSE
    _discount := LEAST(_coupon.discount_value, p_order_total);
  END IF;

  UPDATE public.discount_codes
  SET times_used = COALESCE(times_used, 0) + 1
  WHERE id = _coupon.id;

  INSERT INTO public.coupon_redemptions
    (discount_code_id, member_id, branch_id, order_total, discount_applied, idempotency_key)
  VALUES (_coupon.id, p_member_id, p_branch_id, p_order_total, _discount, p_idempotency_key)
  RETURNING id INTO _redemption_id;

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', _redemption_id,
    'discount', _discount,
    'discount_code_id', _coupon.id,
    'final_total', GREATEST(0, p_order_total - _discount)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_coupon(
  p_redemption_id uuid,
  p_reason text DEFAULT 'cancelled'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _r public.coupon_redemptions%ROWTYPE;
BEGIN
  IF NOT has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role,'staff'::app_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO _r FROM public.coupon_redemptions WHERE id = p_redemption_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Redemption not found'; END IF;
  IF _r.released_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;
  UPDATE public.coupon_redemptions
  SET released_at = now(), release_reason = p_reason
  WHERE id = p_redemption_id;
  UPDATE public.discount_codes
  SET times_used = GREATEST(0, COALESCE(times_used, 0) - 1)
  WHERE id = _r.discount_code_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_coupon(text, uuid, numeric, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_coupon(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. TASKS workflow upgrade  (Phase 2 §8)
-- ---------------------------------------------------------------------------
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS linked_entity_type text,
  ADD COLUMN IF NOT EXISTS linked_entity_id uuid;

CREATE INDEX IF NOT EXISTS idx_tasks_branch ON public.tasks(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON public.tasks(due_date) WHERE status IN ('pending','in_progress');

CREATE TABLE IF NOT EXISTS public.task_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  from_status task_status,
  to_status task_status NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_status_history_task ON public.task_status_history(task_id, created_at DESC);

ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View task history" ON public.task_status_history;
CREATE POLICY "View task history"
ON public.task_status_history FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.tasks t
          WHERE t.id = task_status_history.task_id
            AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid()
                 OR manages_branch(auth.uid(), t.branch_id)))
);

CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id, created_at DESC);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View task comments" ON public.task_comments;
CREATE POLICY "View task comments"
ON public.task_comments FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.tasks t
          WHERE t.id = task_comments.task_id
            AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid()
                 OR manages_branch(auth.uid(), t.branch_id)))
);
DROP POLICY IF EXISTS "Add task comments" ON public.task_comments;
CREATE POLICY "Add task comments"
ON public.task_comments FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.tasks t
              WHERE t.id = task_comments.task_id
                AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid()
                     OR manages_branch(auth.uid(), t.branch_id)))
);

CREATE TABLE IF NOT EXISTS public.task_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  remind_at timestamptz NOT NULL,
  channel text NOT NULL DEFAULT 'in_app',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_reminders_due ON public.task_reminders(remind_at) WHERE sent_at IS NULL;

ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff manage task reminders" ON public.task_reminders;
CREATE POLICY "Staff manage task reminders"
ON public.task_reminders FOR ALL TO authenticated
USING (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role,'staff'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role,'staff'::app_role]));

-- Trigger: log task status changes
CREATE OR REPLACE FUNCTION public.tasks_log_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.task_status_history(task_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_tasks_log_status ON public.tasks;
CREATE TRIGGER trg_tasks_log_status
AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_log_status_change();

-- Trigger: notify assignee on assignment / reassignment
CREATE OR REPLACE FUNCTION public.tasks_notify_assignee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
    INSERT INTO public.notifications(user_id, title, message, type, link, branch_id)
    VALUES (
      NEW.assigned_to,
      'New task assigned',
      COALESCE(NEW.title, 'You have been assigned a task'),
      'task',
      '/tasks?id=' || NEW.id,
      NEW.branch_id
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_tasks_notify_assignee ON public.tasks;
CREATE TRIGGER trg_tasks_notify_assignee
AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_notify_assignee();
