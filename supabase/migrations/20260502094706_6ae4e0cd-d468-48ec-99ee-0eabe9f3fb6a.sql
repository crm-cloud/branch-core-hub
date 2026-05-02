-- ============================================================================
-- P4 — Application-Layer Scoping & Transaction Semantics
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 5.1 Server-enforced active-branch scoping
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_active_branch (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id   uuid NULL REFERENCES public.branches(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_active_branch ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own active branch"  ON public.user_active_branch;
DROP POLICY IF EXISTS "users write own active branch" ON public.user_active_branch;

CREATE POLICY "users read own active branch"
ON public.user_active_branch FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "users write own active branch"
ON public.user_active_branch FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Helper: returns the caller's active branch, NULL = "all branches"
CREATE OR REPLACE FUNCTION public.current_active_branch()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM public.user_active_branch WHERE user_id = auth.uid()
$$;

-- RPC: set or clear active branch (NULL = clear, owners only for clear)
CREATE OR REPLACE FUNCTION public.set_active_branch(p_branch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_owner boolean;
  v_allowed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_is_owner := public.has_role(v_uid, 'owner') OR public.has_role(v_uid, 'admin');

  IF p_branch_id IS NULL THEN
    -- Clearing the active branch (= "All Branches") only allowed for owners/admins
    IF NOT v_is_owner THEN
      RAISE EXCEPTION 'only owners may clear active branch';
    END IF;
  ELSE
    -- Validate the user actually has access to this branch
    IF v_is_owner THEN
      v_allowed := EXISTS (SELECT 1 FROM public.branches WHERE id = p_branch_id);
    ELSE
      v_allowed := EXISTS (
        SELECT 1 FROM public.staff_branches
        WHERE user_id = v_uid AND branch_id = p_branch_id
      ) OR EXISTS (
        SELECT 1 FROM public.employees
        WHERE user_id = v_uid AND branch_id = p_branch_id
      ) OR EXISTS (
        SELECT 1 FROM public.trainers
        WHERE user_id = v_uid AND branch_id = p_branch_id
      ) OR EXISTS (
        SELECT 1 FROM public.members
        WHERE user_id = v_uid AND branch_id = p_branch_id
      );
    END IF;

    IF NOT v_allowed THEN
      RAISE EXCEPTION 'user has no access to branch %', p_branch_id;
    END IF;
  END IF;

  INSERT INTO public.user_active_branch(user_id, branch_id, updated_at)
  VALUES (v_uid, p_branch_id, now())
  ON CONFLICT (user_id) DO UPDATE
    SET branch_id = EXCLUDED.branch_id, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_active_branch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_active_branch() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5.3 Capability-based authorization
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.role_capabilities (
  role        public.app_role NOT NULL,
  capability  text NOT NULL,
  PRIMARY KEY (role, capability)
);

ALTER TABLE public.role_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "all auth read capabilities" ON public.role_capabilities;
CREATE POLICY "all auth read capabilities"
ON public.role_capabilities FOR SELECT
TO authenticated
USING (true);

-- Seed canonical capability matrix
INSERT INTO public.role_capabilities(role, capability) VALUES
  ('owner','view_financials'), ('owner','manage_staff'), ('owner','record_payment'),
  ('owner','approve_discount'), ('owner','cross_branch_view'), ('owner','manage_settings'),
  ('owner','cancel_membership'), ('owner','freeze_membership'), ('owner','manage_devices'),
  ('owner','view_reconciliation'),
  ('admin','view_financials'), ('admin','manage_staff'), ('admin','record_payment'),
  ('admin','approve_discount'), ('admin','cross_branch_view'), ('admin','manage_settings'),
  ('admin','cancel_membership'), ('admin','freeze_membership'), ('admin','manage_devices'),
  ('admin','view_reconciliation'),
  ('manager','view_financials'), ('manager','record_payment'),
  ('manager','approve_discount'), ('manager','cancel_membership'),
  ('manager','freeze_membership'), ('manager','manage_devices'),
  ('staff','record_payment'),
  ('trainer','book_facility'),
  ('member','book_facility')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_capability(_user_id uuid, _capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_capabilities rc ON rc.role = ur.role
    WHERE ur.user_id = _user_id AND rc.capability = _capability
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_capability(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5.2 cancel_membership / freeze_membership atomic RPCs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.membership_action_attempts (
  idempotency_key  text PRIMARY KEY,
  user_id          uuid,
  membership_id    uuid,
  action           text NOT NULL,
  status           text NOT NULL DEFAULT 'pending',
  result           jsonb,
  error            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz
);

ALTER TABLE public.membership_action_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners read membership attempts" ON public.membership_action_attempts;
CREATE POLICY "owners read membership attempts"
ON public.membership_action_attempts FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.cancel_membership(
  p_membership_id   uuid,
  p_reason          text,
  p_refund_amount   numeric DEFAULT 0,
  p_refund_method   text    DEFAULT 'cash',
  p_idempotency_key text    DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_key           text := COALESCE(p_idempotency_key, gen_random_uuid()::text);
  v_membership    record;
  v_refund_inv_id uuid;
  v_payment_id    uuid;
  v_existing      jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.has_capability(v_uid, 'cancel_membership') THEN
    RAISE EXCEPTION 'permission denied: cancel_membership';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'cancellation reason required';
  END IF;

  -- Idempotency
  SELECT result INTO v_existing
  FROM public.membership_action_attempts
  WHERE idempotency_key = v_key AND status = 'succeeded';
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO public.membership_action_attempts(idempotency_key,user_id,membership_id,action)
  VALUES (v_key, v_uid, p_membership_id, 'cancel')
  ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT * INTO v_membership FROM public.memberships WHERE id = p_membership_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'membership % not found', p_membership_id; END IF;
  IF v_membership.status = 'cancelled' THEN
    RAISE EXCEPTION 'membership already cancelled';
  END IF;

  UPDATE public.memberships
     SET status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = v_uid,
         cancellation_reason = p_reason,
         refund_amount = p_refund_amount
   WHERE id = p_membership_id;

  IF p_refund_amount > 0 THEN
    INSERT INTO public.invoices(
      branch_id, member_id, invoice_number,
      subtotal, total_amount, status, notes,
      refund_amount, refund_reason, refunded_at, refunded_by
    ) VALUES (
      v_membership.branch_id, v_membership.member_id, NULL,
      -p_refund_amount, -p_refund_amount, 'refunded',
      'Refund for cancelled membership. Reason: ' || p_reason,
      p_refund_amount, p_reason, now(), v_uid
    )
    RETURNING id INTO v_refund_inv_id;

    INSERT INTO public.invoice_items(
      invoice_id, description, quantity, unit_price, total_amount,
      reference_type, reference_id
    ) VALUES (
      v_refund_inv_id,
      'Refund - membership cancellation',
      1, -p_refund_amount, -p_refund_amount,
      'membership_refund', p_membership_id
    );

    INSERT INTO public.payments(
      branch_id, member_id, invoice_id, amount, payment_method, status, payment_date
    ) VALUES (
      v_membership.branch_id, v_membership.member_id, v_refund_inv_id,
      -p_refund_amount, p_refund_method::payment_method, 'completed', now()
    )
    RETURNING id INTO v_payment_id;
  END IF;

  -- Deactivate member if no other active memberships
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE member_id = v_membership.member_id
      AND status = 'active'
      AND id <> p_membership_id
  ) THEN
    UPDATE public.members SET status = 'inactive' WHERE id = v_membership.member_id;
  END IF;

  -- Lifecycle audit (best-effort)
  BEGIN
    PERFORM public.transition_member_lifecycle(v_membership.member_id, 'suspended', p_reason);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  v_existing := jsonb_build_object(
    'membership_id', p_membership_id,
    'refund_invoice_id', v_refund_inv_id,
    'refund_payment_id', v_payment_id,
    'refund_amount', p_refund_amount
  );

  UPDATE public.membership_action_attempts
     SET status = 'succeeded', result = v_existing, completed_at = now()
   WHERE idempotency_key = v_key;

  PERFORM pg_notify('membership_cancelled',
    jsonb_build_object('membership_id', p_membership_id, 'member_id', v_membership.member_id)::text);

  RETURN v_existing;
EXCEPTION WHEN OTHERS THEN
  UPDATE public.membership_action_attempts
     SET status = 'failed', error = SQLERRM, completed_at = now()
   WHERE idempotency_key = v_key;
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_membership(uuid,text,numeric,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.freeze_membership(
  p_membership_id  uuid,
  p_freeze_days    int,
  p_reason         text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_m   record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.has_capability(v_uid,'freeze_membership') THEN
    RAISE EXCEPTION 'permission denied: freeze_membership';
  END IF;
  IF p_freeze_days IS NULL OR p_freeze_days < 1 THEN
    RAISE EXCEPTION 'freeze_days must be >= 1';
  END IF;

  SELECT * INTO v_m FROM public.memberships WHERE id = p_membership_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'membership % not found', p_membership_id; END IF;
  IF v_m.status NOT IN ('active') THEN
    RAISE EXCEPTION 'only active memberships can be frozen (current: %)', v_m.status;
  END IF;

  UPDATE public.memberships
     SET status = 'frozen',
         freeze_start_date = CURRENT_DATE,
         freeze_end_date   = CURRENT_DATE + p_freeze_days,
         freeze_reason     = p_reason,
         end_date          = end_date + p_freeze_days
   WHERE id = p_membership_id;

  RETURN jsonb_build_object(
    'membership_id', p_membership_id,
    'freeze_days', p_freeze_days,
    'new_end_date', (v_m.end_date + p_freeze_days)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.freeze_membership(uuid,int,text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5.4 policy_audit view (owners surface in SystemHealth)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.policy_audit AS
SELECT
  c.relname                       AS table_name,
  c.relrowsecurity                AS rls_enabled,
  COALESCE(p.policy_count, 0)     AS policy_count,
  COALESCE(p.select_policies, 0)  AS select_policies,
  COALESCE(p.insert_policies, 0)  AS insert_policies,
  COALESCE(p.update_policies, 0)  AS update_policies,
  COALESCE(p.delete_policies, 0)  AS delete_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN (
  SELECT
    schemaname, tablename,
    count(*)                                              AS policy_count,
    count(*) FILTER (WHERE cmd = 'SELECT' OR cmd = 'ALL') AS select_policies,
    count(*) FILTER (WHERE cmd = 'INSERT' OR cmd = 'ALL') AS insert_policies,
    count(*) FILTER (WHERE cmd = 'UPDATE' OR cmd = 'ALL') AS update_policies,
    count(*) FILTER (WHERE cmd = 'DELETE' OR cmd = 'ALL') AS delete_policies
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY schemaname, tablename
) p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relkind = 'r';

GRANT SELECT ON public.policy_audit TO authenticated;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_membership_action_attempts_membership
  ON public.membership_action_attempts(membership_id);
CREATE INDEX IF NOT EXISTS idx_user_active_branch_branch
  ON public.user_active_branch(branch_id);
