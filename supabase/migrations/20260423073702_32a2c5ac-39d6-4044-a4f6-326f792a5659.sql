CREATE OR REPLACE FUNCTION public.onboard_member(
  p_user_id uuid,
  p_branch_id uuid,
  p_full_name text,
  p_email text,
  p_phone text DEFAULT NULL,
  p_source text DEFAULT 'walk-in',
  p_fitness_goals text DEFAULT NULL,
  p_health_conditions text DEFAULT NULL,
  p_referred_by uuid DEFAULT NULL,
  p_created_by uuid DEFAULT auth.uid(),
  p_avatar_storage_path text DEFAULT NULL,
  p_government_id_type text DEFAULT NULL,
  p_government_id_number text DEFAULT NULL,
  p_dietary_preference text DEFAULT NULL,
  p_cuisine_preference text DEFAULT NULL,
  p_allergies text[] DEFAULT '{}'::text[],
  p_fitness_level text DEFAULT NULL,
  p_activity_level text DEFAULT NULL,
  p_equipment_availability text[] DEFAULT '{}'::text[],
  p_injuries_limitations text DEFAULT NULL,
  p_schedule_welcome boolean DEFAULT true,
  p_welcome_channels text[] DEFAULT ARRAY['whatsapp','sms','email']::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member public.members%ROWTYPE;
  v_existing_referral public.referrals%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_referral_id uuid;
  v_channel text;
BEGIN
  IF p_user_id IS NULL OR p_branch_id IS NULL OR COALESCE(trim(p_full_name), '') = '' OR COALESCE(trim(p_email), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing required onboarding fields');
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found for user');
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member already exists for this user', 'member_id', v_member.id, 'member_code', v_member.member_code);
  END IF;

  UPDATE public.profiles
  SET full_name = p_full_name,
      email = p_email,
      phone = COALESCE(p_phone, phone),
      avatar_storage_path = COALESCE(p_avatar_storage_path, avatar_storage_path),
      avatar_url = CASE WHEN p_avatar_storage_path IS NOT NULL THEN NULL ELSE avatar_url END,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.members (
    user_id,
    branch_id,
    status,
    source,
    referred_by,
    fitness_goals,
    health_conditions,
    created_by,
    biometric_enrolled,
    avatar_storage_path,
    biometric_photo_path,
    biometric_photo_url,
    dietary_preference,
    cuisine_preference,
    allergies,
    fitness_level,
    activity_level,
    equipment_availability,
    injuries_limitations,
    lifecycle_state
  ) VALUES (
    p_user_id,
    p_branch_id,
    'active'::public.member_status,
    p_source,
    p_referred_by,
    p_fitness_goals,
    p_health_conditions,
    p_created_by,
    false,
    p_avatar_storage_path,
    p_avatar_storage_path,
    NULL,
    p_dietary_preference,
    p_cuisine_preference,
    COALESCE(p_allergies, '{}'::text[]),
    p_fitness_level,
    p_activity_level,
    COALESCE(p_equipment_availability, '{}'::text[]),
    p_injuries_limitations,
    'onboarded'
  ) RETURNING * INTO v_member;

  IF p_referred_by IS NOT NULL THEN
    SELECT * INTO v_existing_referral
    FROM public.referrals
    WHERE referrer_member_id = p_referred_by
      AND (
        referred_member_id = v_member.id
        OR lower(coalesce(referred_email, '')) = lower(p_email)
        OR regexp_replace(coalesce(referred_phone, ''), '\\D', '', 'g') = regexp_replace(coalesce(p_phone, ''), '\\D', '', 'g')
      )
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.referrals
      SET referred_member_id = COALESCE(referred_member_id, v_member.id),
          referred_name = p_full_name,
          referred_email = COALESCE(p_email, referred_email),
          referred_phone = COALESCE(p_phone, referred_phone),
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('onboarded_by', p_created_by),
          last_status_change_at = now()
      WHERE id = v_existing_referral.id;
      v_referral_id := v_existing_referral.id;
    ELSE
      INSERT INTO public.referrals (
        referrer_member_id,
        referred_member_id,
        referred_name,
        referred_phone,
        referred_email,
        referral_code,
        status,
        lifecycle_status,
        last_status_change_at,
        metadata
      )
      VALUES (
        p_referred_by,
        v_member.id,
        p_full_name,
        COALESCE(p_phone, ''),
        p_email,
        NULL,
        'new'::public.lead_status,
        'joined'::public.referral_lifecycle_status,
        now(),
        jsonb_build_object('created_by', p_created_by, 'source', p_source)
      )
      RETURNING id INTO v_referral_id;
    END IF;

    PERFORM public.advance_referral_lifecycle(
      v_referral_id,
      'joined'::public.referral_lifecycle_status,
      p_created_by,
      'Member onboarded',
      'member_onboarding',
      NULL,
      jsonb_build_object('member_id', v_member.id)
    );
  END IF;

  PERFORM public.log_member_lifecycle_event(
    p_branch_id,
    v_member.id,
    p_created_by,
    'member',
    v_member.id,
    'member_onboarded',
    NULL,
    'onboarded',
    'member_onboarding',
    NULL,
    NULL,
    jsonb_build_object('source', p_source, 'referral_id', v_referral_id)
  );

  IF p_schedule_welcome THEN
    FOREACH v_channel IN ARRAY p_welcome_channels LOOP
      INSERT INTO public.communication_logs (
        branch_id,
        member_id,
        user_id,
        type,
        recipient,
        subject,
        content,
        status,
        delivery_status,
        sent_at,
        delivery_metadata
      ) VALUES (
        p_branch_id,
        v_member.id,
        p_user_id,
        v_channel,
        CASE
          WHEN v_channel = 'email' THEN p_email
          ELSE COALESCE(p_phone, p_email)
        END,
        'Welcome to The Incline',
        format('Welcome %s! Your member code is %s.', p_full_name, COALESCE(v_member.member_code, '')),
        'pending',
        'scheduled'::public.reminder_delivery_status,
        NULL,
        jsonb_build_object('workflow', 'member_onboarding', 'channel', v_channel)
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'member_id', v_member.id,
    'member_code', v_member.member_code,
    'referral_id', v_referral_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_member_membership(
  p_member_id uuid,
  p_plan_id uuid,
  p_branch_id uuid,
  p_start_date date,
  p_discount_amount numeric DEFAULT 0,
  p_discount_reason text DEFAULT NULL,
  p_include_gst boolean DEFAULT false,
  p_gst_rate numeric DEFAULT 0,
  p_payment_method text DEFAULT 'cash',
  p_amount_paying numeric DEFAULT 0,
  p_payment_due_date date DEFAULT NULL,
  p_send_reminders boolean DEFAULT true,
  p_payment_source text DEFAULT 'manual',
  p_idempotency_key text DEFAULT NULL,
  p_assign_locker_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_received_by uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member public.members%ROWTYPE;
  v_plan public.membership_plans%ROWTYPE;
  v_membership public.memberships%ROWTYPE;
  v_invoice public.invoices%ROWTYPE;
  v_existing_event public.member_lifecycle_events%ROWTYPE;
  v_base_price numeric := 0;
  v_admission_fee numeric := 0;
  v_subtotal numeric := 0;
  v_tax_amount numeric := 0;
  v_total_amount numeric := 0;
  v_end_date date;
  v_payment_result jsonb;
  v_remaining_amount numeric := 0;
  v_due_date date;
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

  SELECT * INTO v_member
  FROM public.members
  WHERE id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member not found');
  END IF;

  IF v_member.branch_id <> p_branch_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member branch mismatch');
  END IF;

  SELECT * INTO v_plan
  FROM public.membership_plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Membership plan not found');
  END IF;

  v_base_price := COALESCE(v_plan.discounted_price, v_plan.price, 0);
  v_admission_fee := COALESCE(v_plan.admission_fee, 0);
  v_subtotal := v_base_price + v_admission_fee;
  v_tax_amount := CASE WHEN p_include_gst THEN round(((v_subtotal - COALESCE(p_discount_amount, 0)) * COALESCE(p_gst_rate, 0)) / 100.0, 2) ELSE 0 END;
  v_total_amount := GREATEST(v_subtotal - COALESCE(p_discount_amount, 0), 0) + v_tax_amount;
  v_due_date := COALESCE(p_payment_due_date, p_start_date);
  v_end_date := (p_start_date + make_interval(days => GREATEST(COALESCE(v_plan.duration_days, 1) - 1, 0)))::date;

  INSERT INTO public.memberships (
    member_id,
    plan_id,
    branch_id,
    status,
    start_date,
    end_date,
    original_end_date,
    price_paid,
    discount_amount,
    discount_reason,
    notes,
    created_by
  ) VALUES (
    p_member_id,
    p_plan_id,
    p_branch_id,
    'pending'::public.membership_status,
    p_start_date,
    v_end_date,
    v_end_date,
    v_total_amount,
    COALESCE(p_discount_amount, 0),
    p_discount_reason,
    p_notes,
    p_received_by
  ) RETURNING * INTO v_membership;

  INSERT INTO public.invoices (
    branch_id,
    member_id,
    status,
    subtotal,
    discount_amount,
    tax_amount,
    total_amount,
    amount_paid,
    due_date,
    payment_due_date,
    notes,
    created_by,
    is_gst_invoice,
    gst_rate,
    source,
    invoice_type
  ) VALUES (
    p_branch_id,
    p_member_id,
    'pending'::public.invoice_status,
    v_subtotal,
    COALESCE(p_discount_amount, 0),
    v_tax_amount,
    v_total_amount,
    0,
    v_due_date,
    CASE WHEN p_amount_paying < v_total_amount THEN v_due_date ELSE NULL END,
    p_notes,
    p_received_by,
    p_include_gst,
    COALESCE(p_gst_rate, 0),
    p_payment_source,
    'membership'
  ) RETURNING * INTO v_invoice;

  INSERT INTO public.invoice_items (
    invoice_id,
    description,
    quantity,
    unit_price,
    total_amount,
    reference_type,
    reference_id
  ) VALUES (
    v_invoice.id,
    format('%s - %s days', v_plan.name, v_plan.duration_days),
    1,
    v_base_price,
    v_base_price,
    'membership',
    v_membership.id
  );

  IF v_admission_fee > 0 THEN
    INSERT INTO public.invoice_items (
      invoice_id,
      description,
      quantity,
      unit_price,
      total_amount,
      reference_type,
      reference_id
    ) VALUES (
      v_invoice.id,
      'Admission Fee',
      1,
      v_admission_fee,
      v_admission_fee,
      'admission_fee',
      v_membership.id
    );
  END IF;

  IF p_assign_locker_id IS NOT NULL AND COALESCE(v_plan.includes_free_locker, false) THEN
    INSERT INTO public.locker_assignments (
      locker_id,
      member_id,
      start_date,
      end_date,
      fee_amount,
      is_active
    ) VALUES (
      p_assign_locker_id,
      p_member_id,
      p_start_date,
      v_end_date,
      0,
      false
    );
  END IF;

  IF COALESCE(p_amount_paying, 0) > 0 THEN
    v_payment_result := public.settle_payment(
      p_branch_id,
      v_invoice.id,
      p_member_id,
      p_amount_paying,
      p_payment_method,
      NULL,
      p_notes,
      p_received_by,
      NULL,
      p_payment_source,
      p_idempotency_key,
      NULL,
      NULL,
      jsonb_build_object('membership_id', v_membership.id, 'plan_id', p_plan_id)
    );

    IF COALESCE((v_payment_result ->> 'success')::boolean, false) IS NOT TRUE THEN
      RETURN v_payment_result;
    END IF;
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = v_invoice.id;

  v_remaining_amount := GREATEST(COALESCE(v_invoice.total_amount, 0) - COALESCE(v_invoice.amount_paid, 0), 0);

  UPDATE public.memberships
  SET status = CASE WHEN v_invoice.status = 'paid'::public.invoice_status THEN 'active'::public.membership_status ELSE 'pending'::public.membership_status END,
      updated_at = now()
  WHERE id = v_membership.id
  RETURNING * INTO v_membership;

  IF p_send_reminders AND v_remaining_amount > 0 THEN
    INSERT INTO public.payment_reminders (
      branch_id,
      invoice_id,
      member_id,
      reminder_type,
      scheduled_for,
      status,
      delivery_status,
      channel
    )
    SELECT p_branch_id, v_invoice.id, p_member_id, reminder_type, scheduled_for, 'pending', 'scheduled'::public.reminder_delivery_status, channel
    FROM (
      VALUES
        ('payment_due', (v_due_date - INTERVAL '3 days')::timestamptz, 'whatsapp'),
        ('payment_due', v_due_date::timestamptz, 'sms'),
        ('overdue', (v_due_date + INTERVAL '3 days')::timestamptz, 'email')
    ) AS reminder_plan(reminder_type, scheduled_for, channel)
    WHERE scheduled_for > now();
  END IF;

  IF p_assign_locker_id IS NOT NULL AND COALESCE(v_plan.includes_free_locker, false) AND v_invoice.status = 'paid'::public.invoice_status THEN
    UPDATE public.locker_assignments
    SET is_active = true
    WHERE member_id = p_member_id
      AND locker_id = p_assign_locker_id
      AND start_date = p_start_date;

    UPDATE public.lockers
    SET status = 'assigned'
    WHERE id = p_assign_locker_id;
  END IF;

  PERFORM public.log_member_lifecycle_event(
    p_branch_id,
    p_member_id,
    p_received_by,
    'membership_purchase',
    v_membership.id,
    'membership_purchased',
    NULL,
    v_membership.status::text,
    p_payment_source,
    p_notes,
    p_idempotency_key,
    jsonb_build_object('invoice_id', v_invoice.id, 'plan_id', p_plan_id, 'remaining_amount', v_remaining_amount)
  );

  PERFORM public.evaluate_member_access_state(p_member_id, p_received_by, 'Membership purchase evaluated', true);

  RETURN jsonb_build_object(
    'success', true,
    'member_id', p_member_id,
    'membership_id', v_membership.id,
    'invoice_id', v_invoice.id,
    'invoice_status', v_invoice.status,
    'membership_status', v_membership.status,
    'amount_paid', v_invoice.amount_paid,
    'remaining_amount', v_remaining_amount,
    'total_amount', v_invoice.total_amount
  );
END;
$$;