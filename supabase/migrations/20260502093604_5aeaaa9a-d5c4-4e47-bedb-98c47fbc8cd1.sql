-- ============================================================================
-- P3 — End-to-End Workflow Hardening
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 4.1 MEMBER LIFECYCLE STATE MACHINE
-- ---------------------------------------------------------------------------

-- Constrain allowed states (additive — keeps existing 'active' default safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'members_lifecycle_state_check'
  ) THEN
    ALTER TABLE public.members
      ADD CONSTRAINT members_lifecycle_state_check
      CHECK (lifecycle_state IN (
        'created','pending_verification','verified','active','suspended','archived'
      ));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.member_lifecycle_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  from_state text,
  to_state text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_member_lifecycle_transitions_member
  ON public.member_lifecycle_transitions(member_id, created_at DESC);

ALTER TABLE public.member_lifecycle_transitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view member lifecycle transitions"
  ON public.member_lifecycle_transitions;
CREATE POLICY "Staff view member lifecycle transitions"
ON public.member_lifecycle_transitions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = member_lifecycle_transitions.member_id
      AND (
        manages_branch(auth.uid(), m.branch_id)
        OR has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role])
      )
  )
);
-- No INSERT/UPDATE/DELETE policies → only SECURITY DEFINER funcs can write.

CREATE OR REPLACE FUNCTION public.transition_member_lifecycle(
  p_member_id uuid,
  p_to_state text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current text;
  v_allowed boolean := false;
BEGIN
  SELECT lifecycle_state INTO v_current FROM public.members
   WHERE id = p_member_id FOR UPDATE;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Member % not found', p_member_id USING ERRCODE = 'P0002';
  END IF;

  -- Allowed transitions
  v_allowed := CASE
    WHEN v_current = 'created' AND p_to_state IN ('pending_verification','verified','active','archived') THEN true
    WHEN v_current = 'pending_verification' AND p_to_state IN ('verified','active','archived') THEN true
    WHEN v_current = 'verified' AND p_to_state IN ('active','suspended','archived') THEN true
    WHEN v_current = 'active' AND p_to_state IN ('suspended','archived') THEN true
    WHEN v_current = 'suspended' AND p_to_state IN ('active','archived') THEN true
    WHEN v_current = 'archived' AND p_to_state IN ('active') THEN true  -- restore
    WHEN v_current = p_to_state THEN true                               -- no-op
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid transition % → %', v_current, p_to_state
      USING ERRCODE = 'P0001';
  END IF;

  IF v_current <> p_to_state THEN
    UPDATE public.members
       SET lifecycle_state = p_to_state, updated_at = now()
     WHERE id = p_member_id;

    INSERT INTO public.member_lifecycle_transitions
      (member_id, from_state, to_state, actor_id, reason)
    VALUES (p_member_id, v_current, p_to_state, auth.uid(), p_reason);
  END IF;

  RETURN jsonb_build_object(
    'member_id', p_member_id,
    'from_state', v_current,
    'to_state', p_to_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_member_lifecycle(uuid,text,text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4.2 ATOMIC MEMBERSHIP PURCHASE
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.purchase_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',  -- pending | succeeded | failed
  result jsonb,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_purchase_attempts_member
  ON public.purchase_attempts(member_id, created_at DESC);

ALTER TABLE public.purchase_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Branch staff view purchase attempts" ON public.purchase_attempts;
CREATE POLICY "Branch staff view purchase attempts"
ON public.purchase_attempts FOR SELECT TO authenticated
USING (
  manages_branch(auth.uid(), branch_id)
  OR has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role])
);

CREATE OR REPLACE FUNCTION public.purchase_membership(
  p_idempotency_key text,
  p_member_id uuid,
  p_plan_id uuid,
  p_branch_id uuid,
  p_start_date date,
  p_end_date date,
  p_price numeric,
  p_discount_amount numeric DEFAULT 0,
  p_discount_reason text DEFAULT NULL,
  p_payment_method text DEFAULT 'cash',
  p_amount_paid numeric DEFAULT 0,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_attempt_id uuid;
  v_membership_id uuid;
  v_invoice_id uuid;
  v_payment_result jsonb;
  v_total numeric;
  v_existing jsonb;
BEGIN
  -- Idempotency: return prior result if present
  SELECT result INTO v_existing
    FROM public.purchase_attempts
   WHERE idempotency_key = p_idempotency_key
     AND status = 'succeeded';
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  v_total := GREATEST(0, p_price - COALESCE(p_discount_amount, 0));

  INSERT INTO public.purchase_attempts
    (idempotency_key, branch_id, member_id, created_by)
  VALUES (p_idempotency_key, p_branch_id, p_member_id, auth.uid())
  ON CONFLICT (idempotency_key) DO UPDATE SET status='pending'
  RETURNING id INTO v_attempt_id;

  -- 1. Membership row
  INSERT INTO public.memberships(
    member_id, plan_id, branch_id, start_date, end_date,
    original_end_date, price_paid, discount_amount, discount_reason,
    notes, status, created_by
  ) VALUES (
    p_member_id, p_plan_id, p_branch_id, p_start_date, p_end_date,
    p_end_date, v_total, COALESCE(p_discount_amount,0), p_discount_reason,
    p_notes, 'active'::membership_status, auth.uid()
  ) RETURNING id INTO v_membership_id;

  -- 2. Invoice
  INSERT INTO public.invoices(
    branch_id, member_id, status, subtotal, discount_amount,
    total_amount, amount_paid, invoice_type, created_by
  ) VALUES (
    p_branch_id, p_member_id, 'pending'::invoice_status,
    p_price, COALESCE(p_discount_amount,0), v_total, 0,
    'membership', auth.uid()
  ) RETURNING id INTO v_invoice_id;

  INSERT INTO public.invoice_items(
    invoice_id, description, quantity, unit_price, total_amount,
    reference_type, reference_id
  ) VALUES (
    v_invoice_id,
    'Membership: ' || COALESCE(
      (SELECT name FROM public.membership_plans WHERE id = p_plan_id), 'Plan'),
    1, v_total, v_total, 'membership', v_membership_id
  );

  -- 3. Optional payment via canonical RPC
  IF COALESCE(p_amount_paid,0) > 0 THEN
    v_payment_result := public.record_payment(
      p_branch_id, v_invoice_id, p_member_id,
      p_amount_paid, p_payment_method, NULL,
      p_notes, auth.uid(), NULL
    );
  END IF;

  -- 4. Mark attempt succeeded + emit post-commit event
  UPDATE public.purchase_attempts
     SET status = 'succeeded',
         result = jsonb_build_object(
           'membership_id', v_membership_id,
           'invoice_id', v_invoice_id,
           'payment', v_payment_result
         ),
         completed_at = now()
   WHERE id = v_attempt_id;

  PERFORM pg_notify('membership_created', jsonb_build_object(
    'membership_id', v_membership_id,
    'member_id', p_member_id,
    'branch_id', p_branch_id,
    'invoice_id', v_invoice_id
  )::text);

  RETURN jsonb_build_object(
    'membership_id', v_membership_id,
    'invoice_id', v_invoice_id,
    'payment', v_payment_result
  );
EXCEPTION WHEN OTHERS THEN
  -- Mark attempt failed (in a sub-block so the txn still rolls back)
  BEGIN
    UPDATE public.purchase_attempts
       SET status = 'failed',
           error_message = SQLERRM,
           completed_at = now()
     WHERE idempotency_key = p_idempotency_key;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_membership(
  text, uuid, uuid, uuid, date, date, numeric, numeric, text, text, numeric, text
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4.3 RECONCILIATION
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.reconciliation_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  kind text NOT NULL,                -- 'invoice_drift' | 'wallet_drift' | 'orphan_payment'
  severity text NOT NULL DEFAULT 'warn',
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  reference_type text,
  reference_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recon_findings_open
  ON public.reconciliation_findings(run_date DESC) WHERE resolved_at IS NULL;

ALTER TABLE public.reconciliation_findings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners view reconciliation findings"
  ON public.reconciliation_findings;
CREATE POLICY "Owners view reconciliation findings"
ON public.reconciliation_findings FOR SELECT TO authenticated
USING (has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]));

DROP POLICY IF EXISTS "Owners resolve reconciliation findings"
  ON public.reconciliation_findings;
CREATE POLICY "Owners resolve reconciliation findings"
ON public.reconciliation_findings FOR UPDATE TO authenticated
USING (has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE OR REPLACE FUNCTION public.reconcile_payments_daily()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice_drift int := 0;
  v_wallet_drift int := 0;
  v_run_date date := (now() AT TIME ZONE 'Asia/Kolkata')::date - 1;
BEGIN
  -- Invoice amount_paid drift
  WITH agg AS (
    SELECT i.id, i.branch_id, i.amount_paid AS recorded,
           COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'success'::payment_status), 0) AS actual
      FROM public.invoices i
      LEFT JOIN public.payments p ON p.invoice_id = i.id
     WHERE i.created_at::date >= v_run_date - 7
     GROUP BY i.id, i.branch_id, i.amount_paid
  ), drift AS (
    INSERT INTO public.reconciliation_findings
      (run_date, kind, severity, branch_id, reference_type, reference_id, details)
    SELECT v_run_date, 'invoice_drift', 'warn', branch_id, 'invoice', id,
           jsonb_build_object('recorded', recorded, 'actual', actual,
                              'delta', actual - recorded)
      FROM agg WHERE ABS(actual - recorded) > 0.01
    RETURNING 1
  )
  SELECT count(*) INTO v_invoice_drift FROM drift;

  -- Wallet balance drift
  WITH agg AS (
    SELECT w.id, w.member_id, w.balance AS recorded,
           COALESCE(SUM(CASE WHEN wt.txn_type IN ('credit','refund')
                             THEN wt.amount
                             ELSE -wt.amount END), 0) AS actual
      FROM public.wallets w
      LEFT JOIN public.wallet_transactions wt ON wt.wallet_id = w.id
     GROUP BY w.id, w.member_id, w.balance
  ), drift AS (
    INSERT INTO public.reconciliation_findings
      (run_date, kind, severity, reference_type, reference_id, details)
    SELECT v_run_date, 'wallet_drift', 'warn', 'wallet', id,
           jsonb_build_object('recorded', recorded, 'actual', actual,
                              'delta', actual - recorded, 'member_id', member_id)
      FROM agg WHERE ABS(actual - recorded) > 0.01
    RETURNING 1
  )
  SELECT count(*) INTO v_wallet_drift FROM drift;

  RETURN jsonb_build_object(
    'run_date', v_run_date,
    'invoice_drift', v_invoice_drift,
    'wallet_drift', v_wallet_drift
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_payments_daily() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 4.4 MIPS sync attempts (canonical retry tracker)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.mips_sync_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.access_devices(id) ON DELETE CASCADE,
  attempt_no int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',  -- pending | success | failed | abandoned
  last_error text,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mips_sync_attempts_subject_chk
    CHECK ((member_id IS NOT NULL) OR (staff_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_mips_sync_attempts_pending
  ON public.mips_sync_attempts(next_retry_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_mips_sync_attempts_branch
  ON public.mips_sync_attempts(branch_id, created_at DESC);

ALTER TABLE public.mips_sync_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Branch staff view mips attempts" ON public.mips_sync_attempts;
CREATE POLICY "Branch staff view mips attempts"
ON public.mips_sync_attempts FOR SELECT TO authenticated
USING (
  manages_branch(auth.uid(), branch_id)
  OR has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role])
);

-- ---------------------------------------------------------------------------
-- 4.6 WhatsApp delivery lifecycle + retry queue
-- ---------------------------------------------------------------------------

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS failure_code text,
  ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.whatsapp_send_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  status text NOT NULL DEFAULT 'pending', -- pending | sent | failed | abandoned
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_send_queue_pending
  ON public.whatsapp_send_queue(next_attempt_at)
  WHERE status = 'pending';

ALTER TABLE public.whatsapp_send_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Branch staff view wa queue" ON public.whatsapp_send_queue;
CREATE POLICY "Branch staff view wa queue"
ON public.whatsapp_send_queue FOR SELECT TO authenticated
USING (
  manages_branch(auth.uid(), branch_id)
  OR has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role])
);

-- ---------------------------------------------------------------------------
-- VIEWS — observability surfaces
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.whatsapp_delivery_health AS
SELECT
  branch_id,
  date_trunc('hour', created_at) AS hour,
  count(*) FILTER (WHERE direction = 'outbound') AS sent,
  count(*) FILTER (WHERE delivered_at IS NOT NULL) AS delivered,
  count(*) FILTER (WHERE read_at IS NOT NULL) AS read,
  count(*) FILTER (WHERE status = 'failed') AS failed,
  count(*) FILTER (WHERE status = 'pending'
                   AND created_at < now() - interval '5 minutes') AS stuck_pending
FROM public.whatsapp_messages
WHERE created_at >= now() - interval '24 hours'
GROUP BY branch_id, date_trunc('hour', created_at);

GRANT SELECT ON public.whatsapp_delivery_health TO authenticated;

CREATE OR REPLACE VIEW public.notification_dispatch_summary AS
SELECT
  branch_id,
  channel,
  category,
  count(*) FILTER (WHERE status = 'sent') AS sent,
  count(*) FILTER (WHERE status = 'queued') AS queued,
  count(*) FILTER (WHERE status = 'deduped') AS deduped,
  count(*) FILTER (WHERE status = 'suppressed') AS suppressed,
  count(*) FILTER (WHERE status = 'failed') AS failed,
  count(*) AS total
FROM public.communication_logs
WHERE created_at >= now() - interval '24 hours'
GROUP BY branch_id, channel, category;

GRANT SELECT ON public.notification_dispatch_summary TO authenticated;