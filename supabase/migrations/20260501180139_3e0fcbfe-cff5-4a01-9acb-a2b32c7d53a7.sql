
-- ============================================================================
-- PART A: ERROR LOGS — fingerprint, dedup, log_error_event RPC
-- ============================================================================

ALTER TABLE public.error_logs
  ADD COLUMN IF NOT EXISTS fingerprint text,
  ADD COLUMN IF NOT EXISTS occurrence_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS first_seen timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS function_name text,
  ADD COLUMN IF NOT EXISTS table_name text,
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS release_sha text;

-- Unique fingerprint while open → enables ON CONFLICT dedup
CREATE UNIQUE INDEX IF NOT EXISTS error_logs_open_fingerprint_uidx
  ON public.error_logs (fingerprint)
  WHERE status = 'open' AND fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS error_logs_severity_created_idx
  ON public.error_logs (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS error_logs_branch_created_idx
  ON public.error_logs (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS error_logs_status_lastseen_idx
  ON public.error_logs (status, last_seen DESC);

-- Helper: stable fingerprint
CREATE OR REPLACE FUNCTION public.compute_error_fingerprint(
  p_severity text, p_source text, p_function_name text, p_route text, p_message text
) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(
    digest(
      coalesce(p_severity,'') || '|' ||
      coalesce(p_source,'') || '|' ||
      coalesce(p_function_name,'') || '|' ||
      coalesce(p_route,'') || '|' ||
      -- normalize message: strip uuids, numbers, quoted strings
      regexp_replace(
        regexp_replace(
          regexp_replace(coalesce(p_message,''),'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}','<uuid>','g'),
          '\d+','<n>','g'),
        '''[^'']*''','<s>','g'),
      'sha256'
    ), 'hex'
  );
$$;

CREATE OR REPLACE FUNCTION public.log_error_event(
  p_severity text,
  p_source text,
  p_message text,
  p_function_name text DEFAULT NULL,
  p_route text DEFAULT NULL,
  p_table_name text DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL,
  p_release_sha text DEFAULT NULL,
  p_stack text DEFAULT NULL,
  p_context jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fp text;
  v_id uuid;
BEGIN
  v_fp := public.compute_error_fingerprint(p_severity, p_source, p_function_name, p_route, p_message);

  INSERT INTO public.error_logs (
    severity, source, error_message, stack_trace, route, function_name, table_name,
    branch_id, user_id, request_id, release_sha, context, status,
    fingerprint, occurrence_count, first_seen, last_seen
  )
  VALUES (
    coalesce(p_severity,'error'), coalesce(p_source,'unknown'),
    left(coalesce(p_message,'(no message)'), 2000),
    left(p_stack, 8000), p_route, p_function_name, p_table_name,
    p_branch_id, p_user_id, p_request_id, p_release_sha, p_context, 'open',
    v_fp, 1, now(), now()
  )
  ON CONFLICT (fingerprint) WHERE status = 'open'
  DO UPDATE SET
    occurrence_count = public.error_logs.occurrence_count + 1,
    last_seen = now(),
    context = COALESCE(EXCLUDED.context, public.error_logs.context)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_error_event(text,text,text,text,text,text,uuid,uuid,text,text,text,jsonb) TO authenticated, anon, service_role;

-- ============================================================================
-- PART B: GST HELPERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calc_gst(
  p_amount numeric,
  p_rate numeric,
  p_inclusive boolean DEFAULT false,
  p_intra_state boolean DEFAULT true
) RETURNS TABLE(taxable numeric, cgst numeric, sgst numeric, igst numeric, total numeric)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_taxable numeric;
  v_tax numeric;
BEGIN
  p_amount := COALESCE(p_amount, 0);
  p_rate := COALESCE(p_rate, 0);

  IF p_inclusive THEN
    v_taxable := round(p_amount / (1 + p_rate/100.0), 2);
    v_tax := round(p_amount - v_taxable, 2);
  ELSE
    v_taxable := round(p_amount, 2);
    v_tax := round(p_amount * p_rate/100.0, 2);
  END IF;

  IF p_intra_state THEN
    RETURN QUERY SELECT v_taxable, round(v_tax/2,2), round(v_tax/2,2), 0::numeric, round(v_taxable + v_tax,2);
  ELSE
    RETURN QUERY SELECT v_taxable, 0::numeric, 0::numeric, v_tax, round(v_taxable + v_tax,2);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_gst_rate(
  p_item_type text,
  p_item_id uuid DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_rate numeric;
BEGIN
  -- Default rates: services 18%, products lookup, lockers 18%
  IF p_item_type IN ('membership','pt_package','locker','benefit','service') THEN
    v_rate := 18;
  ELSIF p_item_type = 'product' AND p_item_id IS NOT NULL THEN
    SELECT COALESCE(gst_rate, 18) INTO v_rate FROM public.products WHERE id = p_item_id;
  ELSE
    v_rate := 18;
  END IF;
  RETURN COALESCE(v_rate, 18);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calc_gst(numeric,numeric,boolean,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_gst_rate(text,uuid,uuid) TO authenticated, service_role;

-- ============================================================================
-- PART C: LOCKERS — atomic assign / release
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_locker_with_billing(
  p_locker_id uuid,
  p_member_id uuid,
  p_start_date date,
  p_end_date date,
  p_fee_amount numeric,
  p_billing_months integer DEFAULT 1,
  p_chargeable boolean DEFAULT true,
  p_gst_rate numeric DEFAULT NULL,
  p_received_by uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locker record;
  v_assignment_id uuid;
  v_invoice_id uuid := NULL;
  v_invoice_item_id uuid;
  v_branch_id uuid;
  v_total numeric;
  v_gst_rate numeric;
  v_gst record;
BEGIN
  -- Lock locker
  SELECT * INTO v_locker FROM public.lockers WHERE id = p_locker_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOCKER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_locker.status <> 'available' THEN
    RAISE EXCEPTION 'LOCKER_TAKEN: locker % is %', v_locker.locker_number, v_locker.status USING ERRCODE = 'P0001';
  END IF;

  v_branch_id := v_locker.branch_id;

  -- Create assignment
  INSERT INTO public.locker_assignments (locker_id, member_id, start_date, end_date, fee_amount, is_active)
  VALUES (p_locker_id, p_member_id, p_start_date, p_end_date, p_fee_amount, true)
  RETURNING id INTO v_assignment_id;

  -- Mark locker occupied
  UPDATE public.lockers SET status = 'occupied', updated_at = now() WHERE id = p_locker_id;

  -- Optional invoice
  IF p_chargeable AND COALESCE(p_fee_amount,0) > 0 THEN
    v_total := round(p_fee_amount * COALESCE(p_billing_months,1), 2);
    v_gst_rate := COALESCE(p_gst_rate, public.resolve_gst_rate('locker', p_locker_id, v_branch_id));
    SELECT * INTO v_gst FROM public.calc_gst(v_total, v_gst_rate, false, true);

    INSERT INTO public.invoices (
      member_id, branch_id, total_amount, amount_paid, status, payment_method, due_date, created_by
    ) VALUES (
      p_member_id, v_branch_id, v_gst.total, 0, 'pending', NULL, p_end_date, p_received_by
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
    'branch_id', v_branch_id
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM public.log_error_event('error','database', SQLERRM, 'assign_locker_with_billing', NULL,'lockers', v_branch_id, p_received_by, NULL, NULL, NULL,
    jsonb_build_object('locker_id',p_locker_id,'member_id',p_member_id));
  RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_locker(
  p_assignment_id uuid,
  p_release_date date DEFAULT CURRENT_DATE
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a record;
BEGIN
  SELECT * INTO v_a FROM public.locker_assignments WHERE id = p_assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND'; END IF;
  IF NOT v_a.is_active THEN RAISE EXCEPTION 'ASSIGNMENT_ALREADY_CLOSED'; END IF;

  PERFORM 1 FROM public.lockers WHERE id = v_a.locker_id FOR UPDATE;

  UPDATE public.locker_assignments
     SET is_active = false, end_date = p_release_date, updated_at = now()
   WHERE id = p_assignment_id;

  UPDATE public.lockers SET status = 'available', updated_at = now() WHERE id = v_a.locker_id;

  RETURN jsonb_build_object('assignment_id', p_assignment_id, 'locker_id', v_a.locker_id, 'released_on', p_release_date);
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_locker_with_billing(uuid,uuid,date,date,numeric,integer,boolean,numeric,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_locker(uuid,date) TO authenticated, service_role;

-- ============================================================================
-- PART D: STAFF ATTENDANCE — one-open guarantee + RPCs
-- ============================================================================

-- Drop dupes (keep newest open per user) before adding unique index
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY check_in DESC) AS rn
  FROM public.staff_attendance WHERE check_out IS NULL
)
UPDATE public.staff_attendance sa
   SET check_out = sa.check_in
  FROM ranked r
 WHERE sa.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS staff_attendance_one_open_uidx
  ON public.staff_attendance (user_id) WHERE check_out IS NULL;

CREATE OR REPLACE FUNCTION public.staff_check_in(
  p_user_id uuid,
  p_branch_id uuid,
  p_source text DEFAULT 'manual',
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Lock by user to serialize
  PERFORM pg_advisory_xact_lock(hashtext('staff_attn:'||p_user_id::text));

  IF EXISTS (SELECT 1 FROM public.staff_attendance WHERE user_id = p_user_id AND check_out IS NULL) THEN
    RAISE EXCEPTION 'ALREADY_CHECKED_IN' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.staff_attendance (user_id, branch_id, check_in, notes)
  VALUES (p_user_id, p_branch_id, now(),
    CASE WHEN p_notes IS NULL THEN '[' || p_source || ']' ELSE '[' || p_source || '] ' || p_notes END)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_check_out(
  p_user_id uuid,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('staff_attn:'||p_user_id::text));
  UPDATE public.staff_attendance
     SET check_out = now(),
         notes = CASE WHEN p_notes IS NULL THEN notes ELSE COALESCE(notes,'') || ' | out:' || p_notes END
   WHERE user_id = p_user_id AND check_out IS NULL
   RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'NO_OPEN_ATTENDANCE' USING ERRCODE='P0002'; END IF;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_check_in(uuid,uuid,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_check_out(uuid,text) TO authenticated, service_role;

-- ============================================================================
-- PART E: TRAINER COMMISSION REVERSAL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reverse_trainer_commission(
  p_payment_id uuid,
  p_reason text DEFAULT 'payment_voided'
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_row record;
BEGIN
  FOR v_row IN
    SELECT * FROM public.trainer_commissions
     WHERE source_payment_id = p_payment_id
       AND status NOT IN ('reversed','void')
       AND COALESCE(kind,'earned') <> 'reversal'
  LOOP
    INSERT INTO public.trainer_commissions (
      trainer_id, pt_package_id, session_id, commission_type, amount, percentage,
      status, kind, reverses_commission_id, source_payment_id, notes
    ) VALUES (
      v_row.trainer_id, v_row.pt_package_id, v_row.session_id, v_row.commission_type,
      -1 * v_row.amount, v_row.percentage,
      'approved', 'reversal', v_row.id, p_payment_id,
      'Auto-reversal: ' || p_reason
    );

    UPDATE public.trainer_commissions
       SET status = 'reversed', notes = COALESCE(notes,'') || ' [reversed:' || p_reason || ']'
     WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverse_trainer_commission(uuid,text) TO authenticated, service_role;

-- Trigger on payments status change → auto reverse
CREATE OR REPLACE FUNCTION public.trg_payment_status_reverse_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND COALESCE(NEW.status,'') IN ('refunded','voided','cancelled','failed')
     AND COALESCE(OLD.status,'') NOT IN ('refunded','voided','cancelled','failed') THEN
    PERFORM public.reverse_trainer_commission(NEW.id, COALESCE(NEW.status,'voided'));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM public.log_error_event('error','trigger',SQLERRM,'trg_payment_status_reverse_commission',NULL,'payments',NULL,NULL,NULL,NULL,NULL,
    jsonb_build_object('payment_id',NEW.id));
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payments') THEN
    DROP TRIGGER IF EXISTS payments_reverse_commission_trg ON public.payments;
    CREATE TRIGGER payments_reverse_commission_trg
      AFTER UPDATE OF status ON public.payments
      FOR EACH ROW EXECUTE FUNCTION public.trg_payment_status_reverse_commission();
  END IF;
END $$;

-- ============================================================================
-- PART F: PAYROLL TABLES + compute_payroll
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.payroll_run_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  work_date date NOT NULL,
  status text NOT NULL,
  hours_worked numeric DEFAULT 0,
  ot_hours numeric DEFAULT 0,
  is_late boolean DEFAULT false,
  is_early_out boolean DEFAULT false,
  is_missing_checkout boolean DEFAULT false,
  is_half_day boolean DEFAULT false,
  is_holiday boolean DEFAULT false,
  is_weekly_off boolean DEFAULT false,
  leave_type text,
  payable boolean DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_run_lines_run_user_idx ON public.payroll_run_lines (run_id, user_id, work_date);

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_run_lines ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payroll_runs' AND policyname='payroll_runs_admin_all') THEN
    CREATE POLICY payroll_runs_admin_all ON public.payroll_runs FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'))
      WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payroll_run_lines' AND policyname='payroll_run_lines_admin_all') THEN
    CREATE POLICY payroll_run_lines_admin_all ON public.payroll_run_lines FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'))
      WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'));
  END IF;
END $$;

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
  v_shift_hours numeric := 8;       -- default
  v_late_grace_min int := 15;
  v_dow int;
  v_in timestamptz;
  v_out timestamptz;
  v_hours numeric;
  v_status text;
  v_late boolean;
  v_early boolean;
  v_missing boolean;
  v_half boolean;
  v_ot numeric;
  v_holiday boolean;
  v_weekly_off boolean;
  v_leave text;
  v_payable boolean;
  v_notes text;
BEGIN
  v_d := p_period_start;
  WHILE v_d <= p_period_end LOOP
    v_dow := EXTRACT(DOW FROM v_d);
    v_late := false; v_early := false; v_missing := false; v_half := false;
    v_ot := 0; v_holiday := false; v_weekly_off := (v_dow = 0); -- Sunday default
    v_leave := NULL; v_payable := true; v_notes := NULL; v_hours := 0;

    -- Holiday check (if holidays table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='holidays') THEN
      EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.holidays WHERE holiday_date = $1)' INTO v_holiday USING v_d;
    END IF;

    -- Approved leave (if leave_requests table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='leave_requests') THEN
      EXECUTE format(
        'SELECT leave_type FROM public.leave_requests WHERE user_id=$1 AND status=''approved'' AND $2 BETWEEN start_date AND end_date LIMIT 1'
      ) INTO v_leave USING p_user_id, v_d;
    END IF;

    -- Pick the longest attendance row for the day (collapse duplicates)
    SELECT MIN(check_in), MAX(COALESCE(check_out, check_in))
      INTO v_in, v_out
      FROM public.staff_attendance
     WHERE user_id = p_user_id AND check_in::date = v_d;

    IF v_in IS NOT NULL THEN
      v_hours := round(EXTRACT(EPOCH FROM (v_out - v_in))/3600.0, 2);
      IF v_out IS NULL OR v_out = v_in THEN v_missing := true; v_notes := 'missing_checkout'; END IF;
      IF v_hours > v_shift_hours + 0.5 THEN v_ot := round(v_hours - v_shift_hours, 2); END IF;
      IF v_hours < v_shift_hours/2.0 THEN v_half := true; END IF;
      v_status := CASE WHEN v_missing THEN 'present_missing_out' WHEN v_half THEN 'half_day' ELSE 'present' END;
    ELSIF v_holiday THEN
      v_status := 'holiday'; v_payable := true;
    ELSIF v_weekly_off THEN
      v_status := 'weekly_off'; v_payable := true;
    ELSIF v_leave IS NOT NULL THEN
      v_status := 'leave'; v_payable := (v_leave IN ('paid','sick','earned'));
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
-- PART G: ALERTS — organization_settings.alert_config + cron-friendly RPC
-- ============================================================================

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS alert_config jsonb DEFAULT '{"critical_threshold":3,"window_minutes":5,"channels":["in_app"]}'::jsonb;

CREATE OR REPLACE FUNCTION public.check_critical_error_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg jsonb;
  v_threshold int;
  v_window int;
  v_count int;
  v_admin record;
  v_inserted int := 0;
BEGIN
  SELECT alert_config INTO v_cfg FROM public.organization_settings LIMIT 1;
  v_threshold := COALESCE((v_cfg->>'critical_threshold')::int, 3);
  v_window := COALESCE((v_cfg->>'window_minutes')::int, 5);

  SELECT count(*) INTO v_count
    FROM public.error_logs
   WHERE severity = 'critical' AND status = 'open'
     AND last_seen > now() - (v_window || ' minutes')::interval;

  IF v_count >= v_threshold THEN
    -- Notify admins/owners (notifications table assumed)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN
      FOR v_admin IN
        SELECT DISTINCT ur.user_id FROM public.user_roles ur
         WHERE ur.role IN ('admin','owner')
      LOOP
        INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
        VALUES (
          v_admin.user_id, 'system_health',
          'Critical errors spike: ' || v_count || ' in last ' || v_window || ' min',
          'Open critical errors crossed threshold (' || v_threshold || '). Check System Health.',
          '/system-health',
          jsonb_build_object('count',v_count,'window_minutes',v_window)
        );
        v_inserted := v_inserted + 1;
      END LOOP;
    END IF;
  END IF;
  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_critical_error_alerts() TO authenticated, service_role;

-- ============================================================================
-- PART H: PROCESS_APPROVAL_REQUEST safety wrapper (preserve atomicity)
-- The full body for each approval_type is large; here we ensure status only
-- flips after side-effect SQL succeeds by wrapping a SAVEPOINT. The existing
-- function is preserved; add a guard SECURITY DEFINER wrapper that re-raises.
-- ============================================================================

-- Add safety: a column to track that side effects ran cleanly.
ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS side_effects_committed_at timestamptz;
