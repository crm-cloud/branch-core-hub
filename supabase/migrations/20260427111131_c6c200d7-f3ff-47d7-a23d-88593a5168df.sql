-- =====================================================================
-- FINAL HARDENING SPRINT — Phases 1, 2, 3
-- =====================================================================

-- ---------------------------------------------------------------------
-- PHASE 1.1  TRAINER COMMISSION REVERSAL
-- ---------------------------------------------------------------------
ALTER TABLE public.trainer_commissions
  ADD COLUMN IF NOT EXISTS source_payment_id uuid,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'earned',
  ADD COLUMN IF NOT EXISTS reverses_commission_id uuid REFERENCES public.trainer_commissions(id);

CREATE UNIQUE INDEX IF NOT EXISTS trainer_commissions_one_reversal_per_payment
  ON public.trainer_commissions(source_payment_id, reverses_commission_id)
  WHERE kind = 'reversal' AND source_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS trainer_commissions_source_payment_idx
  ON public.trainer_commissions(source_payment_id)
  WHERE source_payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.void_trainer_commission(
  p_payment_id uuid,
  p_void_ratio numeric DEFAULT 1.0,
  p_reason text DEFAULT 'Reversed due to payment void/refund'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row record;
  v_reversed_count int := 0;
  v_total_reversed numeric := 0;
  v_reverse_amount numeric;
  v_new_id uuid;
BEGIN
  IF p_void_ratio IS NULL OR p_void_ratio <= 0 THEN
    RETURN jsonb_build_object('success', true, 'reversed_count', 0, 'reason', 'zero ratio');
  END IF;
  p_void_ratio := LEAST(p_void_ratio, 1.0);

  FOR v_row IN
    SELECT * FROM public.trainer_commissions
    WHERE source_payment_id = p_payment_id AND kind = 'earned'
      AND status IN ('pending','approved')
    FOR UPDATE
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.trainer_commissions
      WHERE source_payment_id = p_payment_id
        AND reverses_commission_id = v_row.id AND kind = 'reversal'
    ) THEN CONTINUE; END IF;

    v_reverse_amount := -1 * round(v_row.amount * p_void_ratio, 2);

    INSERT INTO public.trainer_commissions (
      trainer_id, pt_package_id, session_id, commission_type,
      amount, percentage, status, notes,
      source_payment_id, kind, reverses_commission_id
    ) VALUES (
      v_row.trainer_id, v_row.pt_package_id, v_row.session_id, v_row.commission_type,
      v_reverse_amount, v_row.percentage, 'approved', p_reason,
      p_payment_id, 'reversal', v_row.id
    ) RETURNING id INTO v_new_id;

    UPDATE public.trainer_commissions
       SET status = 'cancelled',
           notes = COALESCE(notes,'') || E'\n[REVERSED ' || now()::date || '] ' || p_reason
     WHERE id = v_row.id;

    v_reversed_count := v_reversed_count + 1;
    v_total_reversed := v_total_reversed + abs(v_reverse_amount);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'reversed_count', v_reversed_count, 'total_reversed', v_total_reversed);
END;
$$;

REVOKE ALL ON FUNCTION public.void_trainer_commission(uuid,numeric,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.void_trainer_commission(uuid,numeric,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.void_payment(
  p_payment_id uuid,
  p_reason text DEFAULT 'Voided by admin'::text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_invoice public.invoices%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_new_amount_paid numeric;
  v_new_status public.invoice_status;
  v_new_balance numeric;
  v_void_ratio numeric;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Payment not found'); END IF;

  IF v_payment.lifecycle_status = 'voided'::public.payment_transaction_status
     OR v_payment.status = 'refunded'::public.payment_status THEN
    RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'idempotent', true);
  END IF;

  SELECT * INTO v_invoice FROM public.invoices WHERE id = v_payment.invoice_id FOR UPDATE;

  IF v_payment.payment_method = 'wallet'::public.payment_method THEN
    SELECT * INTO v_wallet FROM public.wallets WHERE member_id = v_payment.member_id FOR UPDATE;
    IF FOUND THEN
      v_new_balance := COALESCE(v_wallet.balance, 0) + COALESCE(v_payment.amount, 0);
      INSERT INTO public.wallet_transactions (
        wallet_id, txn_type, amount, balance_after, description, reference_type, reference_id, created_by
      ) VALUES (
        v_wallet.id, 'credit', v_payment.amount, v_new_balance,
        'Refund for voided payment', 'payment', v_payment.id, auth.uid()
      );
      UPDATE public.wallets
         SET balance = v_new_balance,
             total_credited = COALESCE(total_credited, 0) + COALESCE(v_payment.amount, 0),
             updated_at = now()
       WHERE id = v_wallet.id;
    END IF;
  END IF;

  v_new_amount_paid := GREATEST(COALESCE(v_invoice.amount_paid, 0) - COALESCE(v_payment.amount, 0), 0);
  IF v_new_amount_paid >= COALESCE(v_invoice.total_amount, 0) THEN v_new_status := 'paid'::public.invoice_status;
  ELSIF v_new_amount_paid > 0 THEN v_new_status := 'partial'::public.invoice_status;
  ELSE v_new_status := 'pending'::public.invoice_status;
  END IF;

  UPDATE public.payments
     SET status = 'refunded'::public.payment_status,
         lifecycle_status = 'voided'::public.payment_transaction_status,
         void_reason = p_reason, voided_at = now(), voided_by = auth.uid(),
         lifecycle_metadata = lifecycle_metadata || jsonb_build_object('void_reason', p_reason)
   WHERE id = p_payment_id;

  UPDATE public.invoices
     SET amount_paid = v_new_amount_paid, status = v_new_status, updated_at = now()
   WHERE id = v_invoice.id;

  IF v_payment.invoice_id IS NOT NULL THEN
    UPDATE public.payment_transactions
       SET lifecycle_status = 'voided'::public.payment_transaction_status,
           status = 'cancelled', updated_at = now()
     WHERE settled_payment_id = p_payment_id;
  END IF;

  IF v_payment.member_id IS NOT NULL THEN
    UPDATE public.memberships
       SET status = 'pending'::public.membership_status, updated_at = now()
     WHERE id IN (
       SELECT ii.reference_id FROM public.invoice_items ii
        WHERE ii.invoice_id = v_payment.invoice_id
          AND ii.reference_type = 'membership' AND ii.reference_id IS NOT NULL
     ) AND status = 'active'::public.membership_status;
    PERFORM public.evaluate_member_access_state(v_payment.member_id, auth.uid(), p_reason, true);
  END IF;

  IF COALESCE(v_invoice.total_amount, 0) > 0 THEN
    v_void_ratio := LEAST(COALESCE(v_payment.amount,0) / v_invoice.total_amount, 1.0);
  ELSE v_void_ratio := 1.0; END IF;
  PERFORM public.void_trainer_commission(p_payment_id, v_void_ratio, 'Auto-reversed: ' || p_reason);

  INSERT INTO public.payment_lifecycle_events (
    branch_id, payment_id, invoice_id, member_id, actor_user_id,
    event_type, previous_state, new_state, source, metadata
  ) VALUES (
    v_payment.branch_id, v_payment.id, v_payment.invoice_id, v_payment.member_id, auth.uid(),
    'payment_voided', v_invoice.status::text, v_new_status::text, 'void_payment',
    jsonb_build_object('reason', p_reason, 'commission_ratio', v_void_ratio)
  );

  RETURN jsonb_build_object(
    'success', true, 'payment_id', p_payment_id,
    'voided_amount', v_payment.amount, 'invoice_new_status', v_new_status,
    'commission_void_ratio', v_void_ratio
  );
END;
$$;

-- ---------------------------------------------------------------------
-- PHASE 1.2  LEAD → MEMBER CONVERSION
-- ---------------------------------------------------------------------
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS conversion_idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS leads_conversion_idem_key
  ON public.leads(conversion_idempotency_key)
  WHERE conversion_idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.convert_lead_to_member(
  p_lead_id uuid, p_branch_id uuid,
  p_idempotency_key text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_existing_member_id uuid;
  v_member_id uuid;
  v_caller uuid := auth.uid();
  v_member_code text;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT (public.has_role(v_caller,'owner') OR public.has_role(v_caller,'admin')
       OR public.has_role(v_caller,'manager') OR public.has_role(v_caller,'staff')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Lead not found'); END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT converted_member_id INTO v_existing_member_id
      FROM public.leads
     WHERE conversion_idempotency_key = p_idempotency_key
       AND converted_member_id IS NOT NULL LIMIT 1;
    IF v_existing_member_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'member_id', v_existing_member_id, 'idempotent_hit', true);
    END IF;
  END IF;

  IF v_lead.converted_member_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'member_id', v_lead.converted_member_id,
                              'idempotent_hit', true, 'reason', 'lead already converted');
  END IF;

  INSERT INTO public.members (
    branch_id, full_name, phone, email, gender, date_of_birth,
    source, status, member_code
  ) VALUES (
    p_branch_id, COALESCE(v_lead.full_name, 'Unknown'),
    v_lead.phone, v_lead.email, v_lead.gender, v_lead.date_of_birth,
    COALESCE(v_lead.source, 'lead_conversion'), 'active', NULL
  ) RETURNING id, member_code INTO v_member_id, v_member_code;

  UPDATE public.leads
     SET status = 'converted', converted_at = now(),
         won_at = COALESCE(won_at, now()), converted_member_id = v_member_id,
         conversion_idempotency_key = COALESCE(conversion_idempotency_key, p_idempotency_key)
   WHERE id = p_lead_id;

  INSERT INTO public.lead_activities (lead_id, branch_id, actor_id, activity_type, title, metadata)
  VALUES (p_lead_id, p_branch_id, v_caller, 'conversion', 'Converted to member',
          jsonb_build_object('member_id', v_member_id, 'member_code', v_member_code));

  INSERT INTO public.audit_logs (
    branch_id, user_id, action, table_name, record_id, new_data, action_description
  ) VALUES (
    p_branch_id, v_caller, 'INSERT', 'members', v_member_id,
    jsonb_build_object('lead_id', p_lead_id, 'member_id', v_member_id),
    'Lead converted to member (RPC)'
  );

  RETURN jsonb_build_object(
    'success', true, 'member_id', v_member_id,
    'member_code', v_member_code, 'idempotent_hit', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.convert_lead_to_member(uuid,uuid,text,jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_member(uuid,uuid,text,jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- PHASE 2.1  FACILITY SLOT WAITLIST
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.benefit_slot_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES public.benefit_slots(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  branch_id uuid,
  position int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','promoted','left','expired')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  promoted_at timestamptz,
  promoted_booking_id uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS benefit_slot_waitlist_one_active
  ON public.benefit_slot_waitlist(slot_id, member_id) WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS benefit_slot_waitlist_slot_pos
  ON public.benefit_slot_waitlist(slot_id, position) WHERE status = 'waiting';

ALTER TABLE public.benefit_slot_waitlist ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='benefit_slot_waitlist' AND policyname='Staff or member self can view waitlist') THEN
    CREATE POLICY "Staff or member self can view waitlist"
      ON public.benefit_slot_waitlist FOR SELECT TO authenticated
      USING (
        public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')
        OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'staff')
        OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = benefit_slot_waitlist.member_id AND m.user_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='benefit_slot_waitlist' AND policyname='No direct writes — RPC only') THEN
    CREATE POLICY "No direct writes — RPC only"
      ON public.benefit_slot_waitlist FOR ALL TO authenticated
      USING (false) WITH CHECK (false);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.join_facility_waitlist(
  p_slot_id uuid, p_member_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_slot record; v_position int; v_id uuid;
BEGIN
  SELECT * INTO v_slot FROM public.benefit_slots WHERE id = p_slot_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Slot not found'); END IF;

  IF EXISTS (SELECT 1 FROM public.benefit_bookings
             WHERE slot_id = p_slot_id AND member_id = p_member_id
               AND status IN ('booked','attended')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already booked for this slot');
  END IF;

  IF EXISTS (SELECT 1 FROM public.benefit_slot_waitlist
             WHERE slot_id = p_slot_id AND member_id = p_member_id AND status = 'waiting') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already on waitlist');
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_position
    FROM public.benefit_slot_waitlist
   WHERE slot_id = p_slot_id AND status = 'waiting';

  INSERT INTO public.benefit_slot_waitlist (slot_id, member_id, branch_id, position)
  VALUES (p_slot_id, p_member_id, v_slot.branch_id, v_position)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'waitlist_id', v_id, 'position', v_position);
END;
$$;

REVOKE ALL ON FUNCTION public.join_facility_waitlist(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_facility_waitlist(uuid,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.leave_facility_waitlist(p_waitlist_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_caller uuid := auth.uid(); v_row record;
BEGIN
  SELECT w.*, m.user_id AS member_user_id INTO v_row
    FROM public.benefit_slot_waitlist w
    JOIN public.members m ON m.id = w.member_id
   WHERE w.id = p_waitlist_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Not found'); END IF;
  IF v_row.member_user_id <> v_caller AND NOT (
       public.has_role(v_caller,'owner') OR public.has_role(v_caller,'admin')
    OR public.has_role(v_caller,'manager') OR public.has_role(v_caller,'staff')
  ) THEN RETURN jsonb_build_object('success', false, 'error', 'Forbidden'); END IF;
  UPDATE public.benefit_slot_waitlist SET status = 'left' WHERE id = p_waitlist_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.leave_facility_waitlist(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.leave_facility_waitlist(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cancel_facility_slot(
  p_booking_id uuid,
  p_reason text DEFAULT NULL::text,
  p_staff_id uuid DEFAULT NULL::uuid,
  p_override_deadline boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_booking RECORD; v_slot RECORD; v_settings RECORD;
  v_slot_dt timestamptz; v_deadline_minutes integer;
  v_is_privileged boolean := false;
  v_waiter RECORD; v_promoted_booking_id uuid; v_promoted boolean := false;
BEGIN
  SELECT * INTO v_booking FROM public.benefit_bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Booking not found'); END IF;
  IF v_booking.status = 'cancelled' THEN RETURN jsonb_build_object('success', false, 'error', 'Already cancelled'); END IF;

  IF p_override_deadline THEN
    IF p_staff_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Override requires staff identity'); END IF;
    SELECT (public.has_role(p_staff_id,'admin') OR public.has_role(p_staff_id,'owner') OR public.has_role(p_staff_id,'manager'))
      INTO v_is_privileged;
    IF NOT v_is_privileged THEN RETURN jsonb_build_object('success', false, 'error', 'Only admin/owner/manager can override'); END IF;
  END IF;

  SELECT * INTO v_slot FROM public.benefit_slots WHERE id = v_booking.slot_id FOR UPDATE;

  IF NOT p_override_deadline THEN
    SELECT * INTO v_settings FROM public.benefit_settings
      WHERE branch_id = v_slot.branch_id AND benefit_type = v_slot.benefit_type LIMIT 1;
    v_deadline_minutes := COALESCE(v_settings.cancellation_deadline_minutes, 60);
    v_slot_dt := (v_slot.slot_date::timestamp + v_slot.start_time) AT TIME ZONE 'Asia/Kolkata';
    IF now() > v_slot_dt - (v_deadline_minutes || ' minutes')::interval THEN
      RETURN jsonb_build_object('success', false, 'error',
        format('Cancellation deadline is %s minutes before slot', v_deadline_minutes));
    END IF;
  END IF;

  UPDATE public.benefit_bookings SET
    status = 'cancelled', cancelled_at = now(),
    cancellation_reason = p_reason, cancelled_by_staff_id = p_staff_id
  WHERE id = p_booking_id;

  UPDATE public.benefit_slots SET booked_count = GREATEST(booked_count - 1, 0)
    WHERE id = v_booking.slot_id;

  SELECT w.* INTO v_waiter
    FROM public.benefit_slot_waitlist w
   WHERE w.slot_id = v_booking.slot_id AND w.status = 'waiting'
   ORDER BY w.position ASC, w.joined_at ASC
   FOR UPDATE SKIP LOCKED LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.benefit_bookings (
      slot_id, member_id, membership_id, status, source, booked_by_staff_id
    ) VALUES (
      v_booking.slot_id, v_waiter.member_id, NULL, 'booked', 'waitlist_promotion', NULL
    ) RETURNING id INTO v_promoted_booking_id;

    UPDATE public.benefit_slots SET booked_count = booked_count + 1 WHERE id = v_booking.slot_id;

    UPDATE public.benefit_slot_waitlist
       SET status = 'promoted', promoted_at = now(),
           promoted_booking_id = v_promoted_booking_id, notified_at = now()
     WHERE id = v_waiter.id;

    INSERT INTO public.notifications (user_id, branch_id, title, message, type, category, action_url, metadata)
    SELECT m.user_id, v_slot.branch_id,
           'Slot available!',
           format('A spot opened up — you''ve been booked into your %s slot.', v_slot.benefit_type),
           'success', 'waitlist_promotion', '/my-benefits',
           jsonb_build_object('booking_id', v_promoted_booking_id, 'slot_id', v_booking.slot_id)
      FROM public.members m WHERE m.id = v_waiter.member_id AND m.user_id IS NOT NULL;
    v_promoted := true;
  END IF;

  BEGIN PERFORM public._notify_booking_event(p_booking_id, 'facility_slot_cancelled');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success', true, 'overridden', p_override_deadline,
    'waitlist_promoted', v_promoted, 'promoted_booking_id', v_promoted_booking_id
  );
END;
$$;

-- ---------------------------------------------------------------------
-- PHASE 2.2  WALLET / BENEFIT-CREDIT EXPIRY
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_wallet_balances()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_credit RECORD; v_expired_count int := 0; v_total_credits int := 0;
BEGIN
  FOR v_credit IN
    SELECT id, member_id, credits_remaining, benefit_type
      FROM public.member_benefit_credits
     WHERE expires_at IS NOT NULL AND expires_at < now()
       AND credits_remaining > 0
     FOR UPDATE
  LOOP
    UPDATE public.member_benefit_credits
       SET credits_remaining = 0, updated_at = now()
     WHERE id = v_credit.id;

    INSERT INTO public.notifications (user_id, branch_id, title, message, type, category, metadata)
    SELECT m.user_id, m.branch_id,
           'Benefit credits expired',
           format('%s of your %s credits have expired.', v_credit.credits_remaining, v_credit.benefit_type),
           'warning', 'benefit_expiry',
           jsonb_build_object('credit_id', v_credit.id, 'expired_amount', v_credit.credits_remaining)
      FROM public.members m WHERE m.id = v_credit.member_id AND m.user_id IS NOT NULL;

    v_expired_count := v_expired_count + 1;
    v_total_credits := v_total_credits + v_credit.credits_remaining;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'credits_expired_rows', v_expired_count, 'credits_expired_total', v_total_credits);
END;
$$;

REVOKE ALL ON FUNCTION public.expire_wallet_balances() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.expire_wallet_balances() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- PHASE 2.3  APPROVAL AUDIT RETENTION
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.approval_audit_archive (LIKE public.approval_audit_log INCLUDING ALL);
ALTER TABLE public.approval_audit_archive ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='approval_audit_archive' AND policyname='Owners and admins can view archive') THEN
    CREATE POLICY "Owners and admins can view archive"
      ON public.approval_audit_archive FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.archive_approval_audit_log()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_archived int;
BEGIN
  WITH moved AS (
    DELETE FROM public.approval_audit_log
     WHERE created_at < now() - interval '365 days'
     RETURNING *
  )
  INSERT INTO public.approval_audit_archive SELECT * FROM moved;
  GET DIAGNOSTICS v_archived = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'archived', v_archived);
END;
$$;

REVOKE ALL ON FUNCTION public.archive_approval_audit_log() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.archive_approval_audit_log() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- PHASE 3.1  REALTIME TASKS
-- ---------------------------------------------------------------------
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.task_status_history REPLICA IDENTITY FULL;
ALTER TABLE public.task_comments REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='tasks') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='task_status_history') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.task_status_history';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='task_comments') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- PHASE 3.2  NOTIFICATION RETENTION
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_read_deleted int; v_unread_deleted int;
BEGIN
  DELETE FROM public.notifications WHERE is_read = true AND created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_read_deleted = ROW_COUNT;
  DELETE FROM public.notifications WHERE is_read = false AND created_at < now() - interval '180 days';
  GET DIAGNOSTICS v_unread_deleted = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'read_deleted', v_read_deleted, 'unread_deleted', v_unread_deleted);
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_notifications() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- PHASE 1.4  STORAGE RLS — attachments bucket → private
-- ---------------------------------------------------------------------
UPDATE storage.buckets SET public = false WHERE id = 'attachments' AND public = true;

DROP POLICY IF EXISTS "Public can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read attachments" ON storage.objects;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Attachments owner or staff can read') THEN
    CREATE POLICY "Attachments owner or staff can read"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'attachments' AND (
          auth.uid()::text = (storage.foldername(name))[1]
          OR public.has_role(auth.uid(),'owner')
          OR public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'manager')
          OR public.has_role(auth.uid(),'staff')
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Attachments owner can write') THEN
    CREATE POLICY "Attachments owner can write"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Attachments owner can update') THEN
    CREATE POLICY "Attachments owner can update"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Attachments owner or admin can delete') THEN
    CREATE POLICY "Attachments owner or admin can delete"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'attachments' AND (
          auth.uid()::text = (storage.foldername(name))[1]
          OR public.has_role(auth.uid(),'owner')
          OR public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'manager')
        )
      );
  END IF;
END $$;
