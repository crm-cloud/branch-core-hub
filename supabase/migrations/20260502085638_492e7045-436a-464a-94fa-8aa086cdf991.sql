-- =====================================================================
-- P0 cleanup: drop unused RPC overloads, pin telemetry insert policies
-- to explicit roles.
-- =====================================================================

-- 1. Drop unused legacy 5-arg purchase_pt_package overload.
--    Verified no callers in src/, supabase/functions/, or types.ts.
DROP FUNCTION IF EXISTS public.purchase_pt_package(
  _member_id uuid,
  _package_id uuid,
  _trainer_id uuid,
  _branch_id uuid,
  _price_paid numeric
);

-- 2. Drop unused assign_locker_with_invoice (lockerService only calls
--    assign_locker_with_billing).
DROP FUNCTION IF EXISTS public.assign_locker_with_invoice(
  p_locker_id uuid,
  p_member_id uuid,
  p_start_date date,
  p_end_date date,
  p_fee_amount numeric,
  p_billing_months integer,
  p_chargeable boolean
);

-- 3. Pin role on the intentional append-only telemetry policies so the
--    "RLS Policy Always True" warnings are scoped, even if the predicate
--    itself stays `true`. These are append-only logs that must accept
--    inserts from any signed-in user (or service_role).
DO $$
BEGIN
  -- audit_logs: any authenticated user can append their own action.
  -- (The audit trigger sets actor_id server-side; clients can't forge.)
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname='public' AND tablename='audit_logs'
               AND policyname='Authenticated insert audit logs') THEN
    EXECUTE 'ALTER POLICY "Authenticated insert audit logs" ON public.audit_logs TO authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname='public' AND tablename='error_logs'
               AND policyname='Authenticated users can insert error logs') THEN
    EXECUTE 'ALTER POLICY "Authenticated users can insert error logs" ON public.error_logs TO authenticated';
  END IF;

  -- Public click telemetry must remain anon-writable.
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname='public' AND tablename='feedback_google_link_clicks'
               AND policyname='Public can insert click records') THEN
    EXECUTE 'ALTER POLICY "Public can insert click records" ON public.feedback_google_link_clicks TO anon, authenticated';
  END IF;

  -- service_role-only telemetry: pin TO service_role explicitly.
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname='public' AND tablename='dr_probe'
               AND policyname='service_role_writes_dr_probe') THEN
    EXECUTE 'ALTER POLICY "service_role_writes_dr_probe" ON public.dr_probe TO service_role';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname='public' AND tablename='system_health_pings'
               AND policyname='service_role_writes_health') THEN
    EXECUTE 'ALTER POLICY "service_role_writes_health" ON public.system_health_pings TO service_role';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname='public' AND tablename='webhook_failures'
               AND policyname='Service role can insert webhook failures') THEN
    EXECUTE 'ALTER POLICY "Service role can insert webhook failures" ON public.webhook_failures TO service_role';
  END IF;
END $$;

-- 4. Document intent inline so future audits don't re-flag these.
COMMENT ON POLICY "Authenticated insert audit logs" ON public.audit_logs IS
  'Append-only audit trail. Trigger sets actor_id server-side; clients cannot forge.';
COMMENT ON POLICY "Authenticated users can insert error logs" ON public.error_logs IS
  'Append-only error telemetry; routed via log_error_event RPC.';
COMMENT ON POLICY "Public can insert click records" ON public.feedback_google_link_clicks IS
  'Public click tracking for Google review redirect; row contents are non-sensitive.';