-- =========================================================================
-- P0.2 / P0.3 — Atomic write RPCs + branch-scoped RLS reinforcement
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. create_manual_invoice — atomic invoice + line items
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_manual_invoice(
  p_branch_id    uuid,
  p_member_id    uuid,
  p_items        jsonb,        -- [{description, quantity, unit_price, reference_type?, reference_id?}]
  p_due_date     date DEFAULT NULL,
  p_notes        text DEFAULT NULL,
  p_discount_amount numeric DEFAULT 0,
  p_include_gst  boolean DEFAULT false,
  p_gst_rate     numeric DEFAULT 0,
  p_customer_gstin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_invoice_id uuid;
  v_invoice_number text;
  v_item jsonb;
BEGIN
  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'BRANCH_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'NO_ITEMS' USING ERRCODE = '22023';
  END IF;

  -- Compute subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal
      + (COALESCE((v_item->>'quantity')::numeric, 1)
         * COALESCE((v_item->>'unit_price')::numeric, 0));
  END LOOP;

  IF p_include_gst AND p_gst_rate > 0 THEN
    v_tax := round((v_subtotal - COALESCE(p_discount_amount, 0)) * p_gst_rate / 100);
  END IF;
  v_total := v_subtotal - COALESCE(p_discount_amount, 0) + v_tax;

  INSERT INTO public.invoices (
    branch_id, member_id, invoice_number, subtotal,
    discount_amount, tax_amount, total_amount,
    status, due_date, notes,
    is_gst_invoice, gst_rate, customer_gstin
  )
  VALUES (
    p_branch_id, p_member_id, NULL, v_subtotal,
    COALESCE(p_discount_amount, 0), v_tax, v_total,
    'pending', p_due_date, p_notes,
    COALESCE(p_include_gst, false),
    CASE WHEN p_include_gst THEN p_gst_rate ELSE 0 END,
    CASE WHEN p_include_gst THEN p_customer_gstin ELSE NULL END
  )
  RETURNING id, invoice_number INTO v_invoice_id, v_invoice_number;

  -- Insert line items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.invoice_items (
      invoice_id, description, quantity, unit_price, total_amount,
      reference_type, reference_id
    )
    VALUES (
      v_invoice_id,
      v_item->>'description',
      COALESCE((v_item->>'quantity')::numeric, 1),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      COALESCE((v_item->>'quantity')::numeric, 1)
        * COALESCE((v_item->>'unit_price')::numeric, 0),
      v_item->>'reference_type',
      NULLIF(v_item->>'reference_id', '')::uuid
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'total_amount', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_manual_invoice(uuid, uuid, jsonb, date, text, numeric, boolean, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_manual_invoice(uuid, uuid, jsonb, date, text, numeric, boolean, numeric, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.create_manual_invoice(uuid, uuid, jsonb, date, text, numeric, boolean, numeric, text) IS
  'Atomic creation of a manual invoice + items. Replaces the legacy two-step client write.';

-- -------------------------------------------------------------------------
-- 2. bill_locker_period — issue a renewal invoice for an existing assignment
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bill_locker_period(
  p_assignment_id uuid,
  p_amount        numeric,
  p_months        integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_assignment record;
  v_invoice jsonb;
BEGIN
  SELECT la.*, l.locker_number, l.branch_id
  INTO v_assignment
  FROM public.locker_assignments la
  JOIN public.lockers l ON l.id = la.locker_id
  WHERE la.id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_invoice := public.create_manual_invoice(
    p_branch_id => v_assignment.branch_id,
    p_member_id => v_assignment.member_id,
    p_items => jsonb_build_array(jsonb_build_object(
      'description', 'Locker #' || v_assignment.locker_number
                     || ' rental (' || p_months || ' month' || CASE WHEN p_months > 1 THEN 's' ELSE '' END || ')',
      'quantity', p_months,
      'unit_price', p_amount / NULLIF(p_months, 0),
      'reference_type', 'locker',
      'reference_id', v_assignment.locker_id::text
    )),
    p_due_date => (CURRENT_DATE + INTERVAL '7 days')::date
  );

  RETURN v_invoice;
END;
$$;

REVOKE ALL ON FUNCTION public.bill_locker_period(uuid, numeric, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.bill_locker_period(uuid, numeric, integer) TO authenticated, service_role;

-- -------------------------------------------------------------------------
-- 3. Branch-scoped RLS reinforcement (defense-in-depth)
--    Only tighten if the table exists; skip cleanly otherwise.
-- -------------------------------------------------------------------------

-- templates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='templates') THEN
    EXECUTE 'ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "branch_scoped_templates_select" ON public.templates';
    EXECUTE $p$
      CREATE POLICY "branch_scoped_templates_select"
      ON public.templates
      FOR SELECT
      TO authenticated
      USING (
        public.has_role(auth.uid(), 'owner')
        OR public.has_role(auth.uid(), 'admin')
        OR (branch_id IS NOT NULL AND public.is_branch_member(branch_id))
      )
    $p$;
  END IF;
END $$;

-- communication_logs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='communication_logs') THEN
    EXECUTE 'ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "branch_scoped_comm_logs_select" ON public.communication_logs';
    EXECUTE $p$
      CREATE POLICY "branch_scoped_comm_logs_select"
      ON public.communication_logs
      FOR SELECT
      TO authenticated
      USING (
        public.has_role(auth.uid(), 'owner')
        OR public.has_role(auth.uid(), 'admin')
        OR (branch_id IS NOT NULL AND public.is_branch_member(branch_id))
      )
    $p$;
  END IF;
END $$;

-- messages
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='messages') THEN
    EXECUTE 'ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY';
    -- We only add an additional restrictive overlay for non-privileged roles
    -- when a branch_id column exists; otherwise leave existing policies alone.
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='messages' AND column_name='branch_id') THEN
      EXECUTE 'DROP POLICY IF EXISTS "branch_scoped_messages_select" ON public.messages';
      EXECUTE $p$
        CREATE POLICY "branch_scoped_messages_select"
        ON public.messages
        FOR SELECT
        TO authenticated
        USING (
          public.has_role(auth.uid(), 'owner')
          OR public.has_role(auth.uid(), 'admin')
          OR (branch_id IS NOT NULL AND public.is_branch_member(branch_id))
        )
      $p$;
    END IF;
  END IF;
END $$;

-- access_devices
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='access_devices') THEN
    EXECUTE 'ALTER TABLE public.access_devices ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "branch_scoped_devices_select" ON public.access_devices';
    EXECUTE $p$
      CREATE POLICY "branch_scoped_devices_select"
      ON public.access_devices
      FOR SELECT
      TO authenticated
      USING (
        public.has_role(auth.uid(), 'owner')
        OR public.has_role(auth.uid(), 'admin')
        OR (branch_id IS NOT NULL AND public.is_branch_member(branch_id))
      )
    $p$;
  END IF;
END $$;

COMMENT ON POLICY "branch_scoped_devices_select" ON public.access_devices IS
  'Defense-in-depth: non-privileged roles can only see devices in branches they belong to.';

-- biometric_sync_queue (only branch_id column if present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='biometric_sync_queue')
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='biometric_sync_queue' AND column_name='branch_id') THEN
    EXECUTE 'ALTER TABLE public.biometric_sync_queue ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "branch_scoped_bio_queue_select" ON public.biometric_sync_queue';
    EXECUTE $p$
      CREATE POLICY "branch_scoped_bio_queue_select"
      ON public.biometric_sync_queue
      FOR SELECT
      TO authenticated
      USING (
        public.has_role(auth.uid(), 'owner')
        OR public.has_role(auth.uid(), 'admin')
        OR (branch_id IS NOT NULL AND public.is_branch_member(branch_id))
      )
    $p$;
  END IF;
END $$;
