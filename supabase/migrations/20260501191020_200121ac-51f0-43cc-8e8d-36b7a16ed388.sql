-- =====================================================================
-- Disaster Recovery V1 — Active/Passive only.
-- No active-active writes. No automatic DB failover.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. DR mode flag stored in existing key/value `settings` table.
--    Global row: branch_id IS NULL, key = 'dr_mode'.
-- ---------------------------------------------------------------------
INSERT INTO public.settings (branch_id, key, value, description)
SELECT NULL, 'dr_mode',
       jsonb_build_object('enabled', false, 'reason', null, 'set_at', null, 'set_by', null),
       'Global disaster recovery read-only mode. When enabled=true, critical write paths are blocked.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.settings WHERE branch_id IS NULL AND key = 'dr_mode'
);

-- Read DR mode (security definer so anon/authenticated can read regardless of settings RLS)
CREATE OR REPLACE FUNCTION public.is_dr_readonly()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value->>'enabled')::boolean
       FROM public.settings
      WHERE branch_id IS NULL AND key = 'dr_mode'
      LIMIT 1),
    false
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_dr_readonly() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Trigger that blocks writes when dr_mode=true.
--    Service role is NOT auto-bypassed — production edge functions also
--    use service_role and must be frozen during DR.
--    Restore scripts must opt in by setting:  SET LOCAL app.dr_restore = 'true';
--    inside their transaction.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dr_block_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restore_flag text;
BEGIN
  IF NOT public.is_dr_readonly() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- DR is active. Allow only callers that explicitly opted in via a GUC.
  -- current_setting(name, missing_ok=true) returns NULL when unset.
  v_restore_flag := current_setting('app.dr_restore', true);
  IF v_restore_flag = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  RAISE EXCEPTION 'DR_READONLY: writes are temporarily disabled (disaster recovery mode active)'
    USING ERRCODE = 'P0001',
          HINT    = 'Restore scripts must run: SET LOCAL app.dr_restore = ''true''; inside their transaction.';
END;
$$;

-- Attach trigger to all critical write paths
DO $$
DECLARE
  t text;
  critical_tables text[] := ARRAY[
    'invoices','payments','memberships','member_attendance','staff_attendance',
    'rewards_ledger','wallet_transactions','benefit_bookings','benefit_usage',
    'referrals','lockers','approval_requests','ecommerce_orders'
  ];
BEGIN
  FOREACH t IN ARRAY critical_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_dr_block_writes ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_dr_block_writes BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.dr_block_writes()', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3. system_health_pings
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_health_pings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component    text NOT NULL,
  status       text NOT NULL,
  latency_ms   int,
  detail       jsonb,
  observed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_health_pings_component_observed
  ON public.system_health_pings (component, observed_at DESC);

ALTER TABLE public.system_health_pings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_admins_read_health" ON public.system_health_pings;
CREATE POLICY "owners_admins_read_health" ON public.system_health_pings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "service_role_writes_health" ON public.system_health_pings;
CREATE POLICY "service_role_writes_health" ON public.system_health_pings
  FOR INSERT TO service_role WITH CHECK (true);

-- Definer RPC the cron + edge functions call (sidesteps RLS-from-cron concerns)
CREATE OR REPLACE FUNCTION public.record_health_ping(
  p_component text, p_status text, p_latency_ms int DEFAULT NULL, p_detail jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.system_health_pings (component, status, latency_ms, detail)
  VALUES (p_component, p_status, p_latency_ms, p_detail)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_health_ping(text,text,int,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_health_ping(text,text,int,jsonb) TO service_role;

-- ---------------------------------------------------------------------
-- 4. dr_probe — heartbeat written by the DR project to prove isolation
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dr_probe (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source       text NOT NULL,
  observed_at  timestamptz NOT NULL DEFAULT now(),
  payload      jsonb
);
CREATE INDEX IF NOT EXISTS idx_dr_probe_source_observed ON public.dr_probe (source, observed_at DESC);
ALTER TABLE public.dr_probe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_admins_read_dr_probe" ON public.dr_probe;
CREATE POLICY "owners_admins_read_dr_probe" ON public.dr_probe
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "service_role_writes_dr_probe" ON public.dr_probe;
CREATE POLICY "service_role_writes_dr_probe" ON public.dr_probe
  FOR INSERT TO service_role WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 5. dr_drill_log — quarterly drill acceptance criteria
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dr_drill_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_date    date NOT NULL DEFAULT current_date,
  performed_by  uuid,
  outcome       text NOT NULL DEFAULT 'partial',
  db_restored                boolean NOT NULL DEFAULT false,
  storage_restored           boolean NOT NULL DEFAULT false,
  edge_functions_deployed    boolean NOT NULL DEFAULT false,
  app_config_switched        boolean NOT NULL DEFAULT false,
  member_login_ok            boolean NOT NULL DEFAULT false,
  invoice_create_ok          boolean NOT NULL DEFAULT false,
  payment_webhook_ok         boolean NOT NULL DEFAULT false,
  attendance_ok              boolean NOT NULL DEFAULT false,
  whatsapp_webhook_ok        boolean NOT NULL DEFAULT false,
  storage_upload_ok          boolean NOT NULL DEFAULT false,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dr_drill_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_admins_manage_dr_drills" ON public.dr_drill_log;
CREATE POLICY "owners_admins_manage_dr_drills" ON public.dr_drill_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------
-- 6. Schedule a 5-minute DB liveness probe via existing pg_cron
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    -- Remove any prior schedule with the same name
    PERFORM cron.unschedule(jobid)
      FROM cron.job WHERE jobname = 'dr-health-probe-db';
    PERFORM cron.schedule(
      'dr-health-probe-db',
      '*/5 * * * *',
      $job$ SELECT public.record_health_ping('db','ok', 0, jsonb_build_object('source','pg_cron')); $job$
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 7. Self-test: prove freeze semantics.
--    Runs inline; raises NOTICE on each pass and EXCEPTION on any fail.
--    All test rows are rolled back via savepoints, so no production data
--    is left behind.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_test_id uuid;
  v_err     text;
  v_branch  uuid;
BEGIN
  -- Pick any existing branch for FK-safe inserts; skip self-test if none.
  SELECT id INTO v_branch FROM public.branches LIMIT 1;
  IF v_branch IS NULL THEN
    RAISE NOTICE 'DR self-test SKIPPED: no branch row available for FK-safe inserts.';
    RETURN;
  END IF;

  ---------------------------------------------------------------------
  -- A. Baseline (dr_mode=false): writes should succeed.
  ---------------------------------------------------------------------
  UPDATE public.settings
     SET value = jsonb_set(value, '{enabled}', 'false'::jsonb)
   WHERE branch_id IS NULL AND key = 'dr_mode';

  BEGIN
    INSERT INTO public.lockers (branch_id, locker_number, status)
    VALUES (v_branch, 'DR-TEST-A', 'available')
    RETURNING id INTO v_test_id;
    DELETE FROM public.lockers WHERE id = v_test_id;
    RAISE NOTICE 'DR self-test A PASS: write allowed when dr_mode=false';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'DR self-test A FAIL: write blocked when dr_mode=false (%)', SQLERRM;
  END;

  ---------------------------------------------------------------------
  -- Flip on DR mode for the rest of the tests.
  ---------------------------------------------------------------------
  UPDATE public.settings
     SET value = jsonb_set(value, '{enabled}', 'true'::jsonb)
   WHERE branch_id IS NULL AND key = 'dr_mode';

  ---------------------------------------------------------------------
  -- B. dr_mode=true, no app.dr_restore set: write must be blocked
  --    (this DO block runs as the migration owner / postgres role,
  --     which is treated like service_role for this test — proving
  --     that even privileged callers are blocked without the flag).
  ---------------------------------------------------------------------
  BEGIN
    INSERT INTO public.lockers (branch_id, locker_number, status)
    VALUES (v_branch, 'DR-TEST-B', 'available');
    RAISE EXCEPTION 'DR self-test B FAIL: write succeeded with dr_mode=true and no restore flag';
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err LIKE 'DR_READONLY%' THEN
        RAISE NOTICE 'DR self-test B PASS: write blocked when dr_mode=true and app.dr_restore unset';
      ELSE
        RAISE EXCEPTION 'DR self-test B FAIL: unexpected error: %', v_err;
      END IF;
  END;

  ---------------------------------------------------------------------
  -- C. dr_mode=true, app.dr_restore='true' set LOCAL: write must succeed.
  ---------------------------------------------------------------------
  BEGIN
    PERFORM set_config('app.dr_restore', 'true', true);  -- true = LOCAL to current txn
    INSERT INTO public.lockers (branch_id, locker_number, status)
    VALUES (v_branch, 'DR-TEST-C', 'available')
    RETURNING id INTO v_test_id;
    DELETE FROM public.lockers WHERE id = v_test_id;
    RAISE NOTICE 'DR self-test C PASS: write allowed when dr_mode=true AND app.dr_restore=true';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'DR self-test C FAIL: write blocked despite app.dr_restore=true (%)', SQLERRM;
  END;

  ---------------------------------------------------------------------
  -- D. Reset dr_mode=false; writes resume normally.
  ---------------------------------------------------------------------
  UPDATE public.settings
     SET value = jsonb_set(value, '{enabled}', 'false'::jsonb)
   WHERE branch_id IS NULL AND key = 'dr_mode';

  BEGIN
    INSERT INTO public.lockers (branch_id, locker_number, status)
    VALUES (v_branch, 'DR-TEST-D', 'available')
    RETURNING id INTO v_test_id;
    DELETE FROM public.lockers WHERE id = v_test_id;
    RAISE NOTICE 'DR self-test D PASS: writes resume after dr_mode=false';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'DR self-test D FAIL: writes still blocked after dr_mode=false (%)', SQLERRM;
  END;

  RAISE NOTICE 'DR self-test: ALL CHECKS PASSED.';
END $$;