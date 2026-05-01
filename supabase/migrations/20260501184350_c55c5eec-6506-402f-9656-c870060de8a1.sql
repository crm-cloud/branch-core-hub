-- ============================================================================
-- Branded payroll workflow + secure role management
-- ============================================================================

ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_by uuid,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE TABLE IF NOT EXISTS public.payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  staff_kind text DEFAULT 'employee',
  calc_base numeric NOT NULL DEFAULT 0,
  calc_pt_commission numeric NOT NULL DEFAULT 0,
  calc_ot numeric NOT NULL DEFAULT 0,
  calc_deductions numeric NOT NULL DEFAULT 0,
  calc_gross numeric NOT NULL DEFAULT 0,
  calc_net numeric NOT NULL DEFAULT 0,
  calc_attendance jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_base numeric NOT NULL DEFAULT 0,
  final_pt_commission numeric NOT NULL DEFAULT 0,
  final_ot numeric NOT NULL DEFAULT 0,
  final_bonus numeric NOT NULL DEFAULT 0,
  final_deductions numeric NOT NULL DEFAULT 0,
  final_advance numeric NOT NULL DEFAULT 0,
  final_penalty numeric NOT NULL DEFAULT 0,
  final_gross numeric NOT NULL DEFAULT 0,
  final_net numeric NOT NULL DEFAULT 0,
  adjustment_reason text,
  status text NOT NULL DEFAULT 'draft',
  payment_method text,
  payment_reference text,
  payslip_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, user_id)
);
CREATE INDEX IF NOT EXISTS payroll_items_run_idx ON public.payroll_items(run_id);
CREATE INDEX IF NOT EXISTS payroll_items_user_idx ON public.payroll_items(user_id);

CREATE TABLE IF NOT EXISTS public.payroll_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  item_id uuid,
  actor_id uuid,
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_audit_run_idx ON public.payroll_audit(run_id);
CREATE INDEX IF NOT EXISTS payroll_audit_item_idx ON public.payroll_audit(item_id);

ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_audit ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payroll_items' AND policyname='payroll_items_admin_all') THEN
    CREATE POLICY payroll_items_admin_all ON public.payroll_items FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'))
      WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payroll_items' AND policyname='payroll_items_self_read') THEN
    CREATE POLICY payroll_items_self_read ON public.payroll_items FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payroll_audit' AND policyname='payroll_audit_admin_read') THEN
    CREATE POLICY payroll_audit_admin_read ON public.payroll_audit FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'manager'));
  END IF;
END $$;

-- Aggregate compute_payroll into single calc summary
CREATE OR REPLACE FUNCTION public.payroll_summarize(
  p_user_id uuid, p_period_start date, p_period_end date
) RETURNS TABLE(
  base numeric, ot_hours numeric, attendance jsonb
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_present int := 0; v_half int := 0; v_late int := 0; v_missing int := 0;
  v_leave int := 0; v_holiday int := 0; v_weekly_off int := 0; v_absent int := 0;
  v_ot numeric := 0; v_payable_days numeric := 0; v_total_days int := 0;
  v_monthly_salary numeric := 0;
BEGIN
  SELECT COALESCE(monthly_salary, 0) INTO v_monthly_salary
    FROM public.employees WHERE user_id = p_user_id LIMIT 1;
  IF v_monthly_salary = 0 THEN
    SELECT COALESCE(monthly_salary, 0) INTO v_monthly_salary
      FROM public.trainers WHERE user_id = p_user_id LIMIT 1;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status='present'),
    COUNT(*) FILTER (WHERE is_half_day),
    COUNT(*) FILTER (WHERE is_late),
    COUNT(*) FILTER (WHERE is_missing_checkout),
    COUNT(*) FILTER (WHERE status='leave'),
    COUNT(*) FILTER (WHERE is_holiday),
    COUNT(*) FILTER (WHERE is_weekly_off),
    COUNT(*) FILTER (WHERE status='absent'),
    COALESCE(SUM(ot_hours),0),
    COALESCE(SUM(CASE WHEN payable THEN (CASE WHEN is_half_day THEN 0.5 ELSE 1 END) ELSE 0 END),0),
    COUNT(*)
  INTO v_present, v_half, v_late, v_missing, v_leave, v_holiday, v_weekly_off, v_absent, v_ot, v_payable_days, v_total_days
  FROM public.compute_payroll(p_user_id, p_period_start, p_period_end, NULL);

  base := CASE WHEN v_total_days > 0 THEN round((v_monthly_salary * v_payable_days / v_total_days)::numeric, 2) ELSE 0 END;
  ot_hours := v_ot;
  attendance := jsonb_build_object(
    'present', v_present, 'half_day', v_half, 'late', v_late,
    'missing_checkout', v_missing, 'leave', v_leave, 'holiday', v_holiday,
    'weekly_off', v_weekly_off, 'absent', v_absent,
    'payable_days', v_payable_days, 'total_days', v_total_days,
    'monthly_salary', v_monthly_salary
  );
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.payroll_create_run(
  p_branch_id uuid, p_period_start date, p_period_end date
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run_id uuid;
  v_user record;
  v_summary record;
  v_gross numeric;
BEGIN
  IF NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  INSERT INTO public.payroll_runs (branch_id, period_start, period_end, status, created_by)
  VALUES (p_branch_id, p_period_start, p_period_end, 'calculated', auth.uid())
  RETURNING id INTO v_run_id;

  FOR v_user IN
    SELECT DISTINCT u.user_id, u.kind FROM (
      SELECT user_id, 'employee'::text AS kind FROM public.employees
        WHERE user_id IS NOT NULL AND status = 'active'
          AND (p_branch_id IS NULL OR branch_id = p_branch_id)
      UNION
      SELECT user_id, 'trainer'::text AS kind FROM public.trainers
        WHERE user_id IS NOT NULL AND status = 'active'
          AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    ) u
  LOOP
    SELECT * INTO v_summary FROM public.payroll_summarize(v_user.user_id, p_period_start, p_period_end);
    v_gross := COALESCE(v_summary.base,0);

    INSERT INTO public.payroll_items (
      run_id, user_id, staff_kind,
      calc_base, calc_pt_commission, calc_ot, calc_deductions, calc_gross, calc_net, calc_attendance,
      final_base, final_pt_commission, final_ot, final_deductions, final_gross, final_net
    ) VALUES (
      v_run_id, v_user.user_id, v_user.kind,
      v_summary.base, 0, v_summary.ot_hours, 0, v_gross, v_gross, v_summary.attendance,
      v_summary.base, 0, v_summary.ot_hours, 0, v_gross, v_gross
    )
    ON CONFLICT (run_id, user_id) DO NOTHING;
  END LOOP;

  INSERT INTO public.payroll_audit (run_id, actor_id, action, after_data)
  VALUES (v_run_id, auth.uid(), 'run_created',
          jsonb_build_object('branch_id', p_branch_id, 'period_start', p_period_start, 'period_end', p_period_end));

  RETURN v_run_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.payroll_adjust_item(
  p_item_id uuid, p_patch jsonb, p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before jsonb; v_after jsonb;
  v_run_status text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  IF COALESCE(p_reason,'') = '' THEN
    RAISE EXCEPTION 'Reason is required for adjustments';
  END IF;

  SELECT pr.status INTO v_run_status FROM public.payroll_runs pr
    JOIN public.payroll_items pi ON pi.run_id = pr.id WHERE pi.id = p_item_id;
  IF v_run_status IN ('processed','paid') THEN
    RAISE EXCEPTION 'Run already processed; cannot adjust';
  END IF;

  SELECT to_jsonb(pi) INTO v_before FROM public.payroll_items pi WHERE id = p_item_id;

  UPDATE public.payroll_items
    SET
      final_base = COALESCE((p_patch->>'final_base')::numeric, final_base),
      final_pt_commission = COALESCE((p_patch->>'final_pt_commission')::numeric, final_pt_commission),
      final_ot = COALESCE((p_patch->>'final_ot')::numeric, final_ot),
      final_bonus = COALESCE((p_patch->>'final_bonus')::numeric, final_bonus),
      final_deductions = COALESCE((p_patch->>'final_deductions')::numeric, final_deductions),
      final_advance = COALESCE((p_patch->>'final_advance')::numeric, final_advance),
      final_penalty = COALESCE((p_patch->>'final_penalty')::numeric, final_penalty),
      adjustment_reason = p_reason,
      status = 'draft',
      updated_at = now()
    WHERE id = p_item_id;

  UPDATE public.payroll_items SET
    final_gross = final_base + final_pt_commission + final_bonus,
    final_net = (final_base + final_pt_commission + final_bonus) - (final_deductions + final_advance + final_penalty)
    WHERE id = p_item_id;

  SELECT to_jsonb(pi) INTO v_after FROM public.payroll_items pi WHERE id = p_item_id;

  INSERT INTO public.payroll_audit (run_id, item_id, actor_id, action, before_data, after_data, reason)
  SELECT run_id, id, auth.uid(), 'item_adjusted', v_before, v_after, p_reason
    FROM public.payroll_items WHERE id = p_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.payroll_review_items(p_item_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  UPDATE public.payroll_items SET status = 'reviewed', updated_at = now()
    WHERE id = ANY(p_item_ids) AND status IN ('draft','reviewed');
  INSERT INTO public.payroll_audit (item_id, actor_id, action)
    SELECT unnest(p_item_ids), auth.uid(), 'item_reviewed';
END;
$$;

CREATE OR REPLACE FUNCTION public.payroll_approve_run(p_run_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only owners/admins can approve payroll';
  END IF;
  UPDATE public.payroll_items SET status = 'approved', updated_at = now()
    WHERE run_id = p_run_id AND status = 'reviewed';
  UPDATE public.payroll_runs SET status = 'approved', approved_by = auth.uid(), approved_at = now()
    WHERE id = p_run_id;
  INSERT INTO public.payroll_audit (run_id, actor_id, action)
    VALUES (p_run_id, auth.uid(), 'run_approved');
END;
$$;

CREATE OR REPLACE FUNCTION public.payroll_process_items(p_item_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only owners/admins can process payroll';
  END IF;
  UPDATE public.payroll_items SET status = 'processed', updated_at = now()
    WHERE id = ANY(p_item_ids) AND status = 'approved';
  INSERT INTO public.payroll_audit (item_id, actor_id, action)
    SELECT unnest(p_item_ids), auth.uid(), 'item_processed';
END;
$$;

CREATE OR REPLACE FUNCTION public.payroll_mark_paid(
  p_item_ids uuid[], p_method text, p_reference text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only owners/admins can mark payroll as paid';
  END IF;
  UPDATE public.payroll_items
    SET status = 'paid', payment_method = p_method, payment_reference = p_reference, updated_at = now()
    WHERE id = ANY(p_item_ids) AND status = 'processed';
  INSERT INTO public.payroll_audit (item_id, actor_id, action, after_data)
    SELECT unnest(p_item_ids), auth.uid(), 'item_paid',
           jsonb_build_object('method', p_method, 'reference', p_reference);
END;
$$;

GRANT EXECUTE ON FUNCTION public.payroll_create_run(uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_adjust_item(uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_review_items(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_approve_run(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_process_items(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_mark_paid(uuid[],text,text) TO authenticated;

-- --- PART B: role audit + secure role RPCs ---------------------------------

CREATE TABLE IF NOT EXISTS public.role_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  role app_role,
  branch_id uuid,
  reason text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS role_change_audit_target_idx ON public.role_change_audit(target_user_id);

CREATE TABLE IF NOT EXISTS public.role_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  role app_role NOT NULL,
  branch_id uuid,
  action text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS role_change_requests_status_idx ON public.role_change_requests(status);

ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_change_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='role_change_audit' AND policyname='rca_admin_read') THEN
    CREATE POLICY rca_admin_read ON public.role_change_audit FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='role_change_requests' AND policyname='rcr_admin_read') THEN
    CREATE POLICY rcr_admin_read ON public.role_change_requests FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.assign_user_role(
  p_target_user_id uuid, p_role app_role, p_branch_id uuid, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner boolean := public.has_role(auth.uid(),'owner');
  v_admin boolean := public.has_role(auth.uid(),'admin');
  v_request_id uuid;
BEGIN
  IF NOT (v_owner OR v_admin) THEN RAISE EXCEPTION 'Only owners/admins can manage roles'; END IF;
  IF COALESCE(p_reason,'') = '' THEN RAISE EXCEPTION 'Reason is required'; END IF;
  IF p_role IN ('manager','staff','trainer') AND p_branch_id IS NULL THEN
    RAISE EXCEPTION 'Branch is required for % role', p_role;
  END IF;

  IF p_role IN ('owner','admin') AND NOT v_owner THEN
    INSERT INTO public.role_change_requests (target_user_id, requested_by, role, branch_id, action, reason)
    VALUES (p_target_user_id, auth.uid(), p_role, p_branch_id, 'assign', p_reason)
    RETURNING id INTO v_request_id;
    INSERT INTO public.role_change_audit (target_user_id, actor_id, action, role, branch_id, reason)
    VALUES (p_target_user_id, auth.uid(), 'requested', p_role, p_branch_id, p_reason);
    RETURN jsonb_build_object('status','pending_approval','request_id', v_request_id);
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (p_target_user_id, p_role)
    ON CONFLICT (user_id, role) DO NOTHING;

  IF p_branch_id IS NOT NULL THEN
    INSERT INTO public.staff_branches (user_id, branch_id) VALUES (p_target_user_id, p_branch_id)
      ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.role_change_audit (target_user_id, actor_id, action, role, branch_id, reason, after_data)
  VALUES (p_target_user_id, auth.uid(), 'assigned', p_role, p_branch_id, p_reason,
    jsonb_build_object('role', p_role, 'branch_id', p_branch_id));

  RETURN jsonb_build_object('status','assigned');
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_user_role(
  p_target_user_id uuid, p_role app_role, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner boolean := public.has_role(auth.uid(),'owner');
  v_admin boolean := public.has_role(auth.uid(),'admin');
  v_count int; v_request_id uuid;
BEGIN
  IF NOT (v_owner OR v_admin) THEN RAISE EXCEPTION 'Only owners/admins can manage roles'; END IF;
  IF COALESCE(p_reason,'') = '' THEN RAISE EXCEPTION 'Reason is required'; END IF;

  IF p_role IN ('owner','admin') THEN
    SELECT count(*) INTO v_count FROM public.user_roles WHERE role = p_role;
    IF v_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last % from the system', p_role;
    END IF;
    IF NOT v_owner THEN
      INSERT INTO public.role_change_requests (target_user_id, requested_by, role, action, reason)
      VALUES (p_target_user_id, auth.uid(), p_role, 'remove', p_reason)
      RETURNING id INTO v_request_id;
      INSERT INTO public.role_change_audit (target_user_id, actor_id, action, role, reason)
      VALUES (p_target_user_id, auth.uid(), 'requested', p_role, p_reason);
      RETURN jsonb_build_object('status','pending_approval','request_id', v_request_id);
    END IF;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = p_target_user_id AND role = p_role;

  INSERT INTO public.role_change_audit (target_user_id, actor_id, action, role, reason)
  VALUES (p_target_user_id, auth.uid(), 'removed', p_role, p_reason);

  RETURN jsonb_build_object('status','removed');
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_role_change_request(
  p_request_id uuid, p_approve boolean, p_decision_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req record;
BEGIN
  IF NOT public.has_role(auth.uid(),'owner') THEN
    RAISE EXCEPTION 'Only owners can decide role change requests';
  END IF;
  SELECT * INTO v_req FROM public.role_change_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already decided'; END IF;

  UPDATE public.role_change_requests
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        decided_by = auth.uid(), decided_at = now(), decision_reason = p_decision_reason
    WHERE id = p_request_id;

  IF p_approve THEN
    IF v_req.action = 'assign' THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (v_req.target_user_id, v_req.role)
        ON CONFLICT (user_id, role) DO NOTHING;
      IF v_req.branch_id IS NOT NULL THEN
        INSERT INTO public.staff_branches (user_id, branch_id) VALUES (v_req.target_user_id, v_req.branch_id)
          ON CONFLICT DO NOTHING;
      END IF;
    ELSIF v_req.action = 'remove' THEN
      DELETE FROM public.user_roles WHERE user_id = v_req.target_user_id AND role = v_req.role;
    END IF;
    INSERT INTO public.role_change_audit (target_user_id, actor_id, action, role, branch_id, reason)
    VALUES (v_req.target_user_id, auth.uid(), 'approved', v_req.role, v_req.branch_id, p_decision_reason);
  ELSE
    INSERT INTO public.role_change_audit (target_user_id, actor_id, action, role, branch_id, reason)
    VALUES (v_req.target_user_id, auth.uid(), 'rejected', v_req.role, v_req.branch_id, p_decision_reason);
  END IF;

  RETURN jsonb_build_object('status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END);
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid,app_role,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_user_role(uuid,app_role,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_role_change_request(uuid,boolean,text) TO authenticated;
