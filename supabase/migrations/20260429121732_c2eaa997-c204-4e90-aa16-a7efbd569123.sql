
-- 1) Extend benefit_type enum with scanner kinds
ALTER TYPE public.benefit_type ADD VALUE IF NOT EXISTS 'body_scan';
ALTER TYPE public.benefit_type ADD VALUE IF NOT EXISTS 'posture_scan';

-- 2) RLS: members can read their own howbody reports
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='howbody_body_reports' AND policyname='Members read own body reports') THEN
    EXECUTE $p$
      CREATE POLICY "Members read own body reports"
      ON public.howbody_body_reports
      FOR SELECT
      TO authenticated
      USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()))
    $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='howbody_posture_reports' AND policyname='Members read own posture reports') THEN
    EXECUTE $p$
      CREATE POLICY "Members read own posture reports"
      ON public.howbody_posture_reports
      FOR SELECT
      TO authenticated
      USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()))
    $p$;
  END IF;
END $$;

-- 3) Quota helper RPC
CREATE OR REPLACE FUNCTION public.howbody_scan_quota(_member_id uuid, _kind text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_allowed boolean := false;
  v_plan_limit int := 0;
  v_used int := 0;
  v_addon_remaining int := 0;
  v_month_start timestamptz := date_trunc('month', now());
  v_benefit_enum text := CASE WHEN _kind = 'posture' THEN 'posture_scan' ELSE 'body_scan' END;
BEGIN
  SELECT
    COALESCE(
      CASE WHEN _kind = 'posture' THEN mp.posture_scan_allowed ELSE mp.body_scan_allowed END,
      false
    ),
    COALESCE(mp.scans_per_month, 0)
  INTO v_plan_allowed, v_plan_limit
  FROM public.memberships m
  JOIN public.membership_plans mp ON mp.id = m.plan_id
  WHERE m.member_id = _member_id
    AND m.status = 'active'
    AND m.end_date >= CURRENT_DATE
  ORDER BY m.end_date DESC
  LIMIT 1;

  IF _kind = 'posture' THEN
    SELECT COUNT(*) INTO v_used
    FROM public.howbody_posture_reports
    WHERE member_id = _member_id AND created_at >= v_month_start;
  ELSE
    SELECT COUNT(*) INTO v_used
    FROM public.howbody_body_reports
    WHERE member_id = _member_id AND created_at >= v_month_start;
  END IF;

  SELECT COALESCE(SUM(credits_remaining), 0) INTO v_addon_remaining
  FROM public.member_benefit_credits
  WHERE member_id = _member_id
    AND benefit_type::text = v_benefit_enum
    AND credits_remaining > 0
    AND (expires_at IS NULL OR expires_at > now());

  RETURN jsonb_build_object(
    'kind', _kind,
    'plan_allowed', v_plan_allowed,
    'plan_limit', v_plan_limit,
    'used_this_month', v_used,
    'plan_remaining', GREATEST(0, CASE WHEN v_plan_limit = 0 AND v_plan_allowed THEN 9999 ELSE v_plan_limit - v_used END),
    'addon_remaining', v_addon_remaining,
    'allowed', (v_plan_allowed AND (v_plan_limit = 0 OR v_used < v_plan_limit)) OR v_addon_remaining > 0,
    'reason', CASE
      WHEN NOT v_plan_allowed AND v_addon_remaining = 0 THEN 'plan_no_scan'
      WHEN v_plan_limit > 0 AND v_used >= v_plan_limit AND v_addon_remaining = 0 THEN 'monthly_limit'
      ELSE 'ok'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.howbody_scan_quota(uuid, text) TO authenticated, anon, service_role;

-- 4) Mirror trigger: HOWBODY body report -> member_measurements
CREATE OR REPLACE FUNCTION public.howbody_mirror_body_to_measurements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recorded_at timestamptz := COALESCE(NEW.test_time, NEW.created_at, now());
BEGIN
  INSERT INTO public.member_measurements
    (member_id, recorded_at, weight_kg, body_fat_percentage, notes)
  VALUES
    (NEW.member_id, v_recorded_at, NEW.weight, NEW.pbf, 'HOWBODY auto-sync (body composition)');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_howbody_mirror_body ON public.howbody_body_reports;
CREATE TRIGGER trg_howbody_mirror_body
AFTER INSERT ON public.howbody_body_reports
FOR EACH ROW EXECUTE FUNCTION public.howbody_mirror_body_to_measurements();

-- 5) Mirror trigger: HOWBODY posture report -> member_measurements (posture / body shape only)
CREATE OR REPLACE FUNCTION public.howbody_mirror_posture_to_measurements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recorded_at timestamptz := COALESCE(NEW.test_time, NEW.created_at, now());
BEGIN
  INSERT INTO public.member_measurements
    (member_id, recorded_at, posture_type, body_shape_profile, notes)
  VALUES
    (NEW.member_id, v_recorded_at, NEW.posture_type, NEW.body_shape_profile, 'HOWBODY auto-sync (posture)');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_howbody_mirror_posture ON public.howbody_posture_reports;
CREATE TRIGGER trg_howbody_mirror_posture
AFTER INSERT ON public.howbody_posture_reports
FOR EACH ROW EXECUTE FUNCTION public.howbody_mirror_posture_to_measurements();

-- 6) Notification on new scan
CREATE OR REPLACE FUNCTION public.howbody_notify_member_body()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_branch uuid;
BEGIN
  SELECT user_id, branch_id INTO v_user, v_branch FROM public.members WHERE id = NEW.member_id;
  IF v_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, branch_id, title, message, type, category, action_url)
    VALUES (v_user, v_branch, 'New body composition scan ready',
            'Your latest HOWBODY scan is now in your Progress tab.',
            'success', 'progress', '/my-progress');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_howbody_notify_body ON public.howbody_body_reports;
CREATE TRIGGER trg_howbody_notify_body
AFTER INSERT ON public.howbody_body_reports
FOR EACH ROW EXECUTE FUNCTION public.howbody_notify_member_body();

CREATE OR REPLACE FUNCTION public.howbody_notify_member_posture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_branch uuid;
BEGIN
  SELECT user_id, branch_id INTO v_user, v_branch FROM public.members WHERE id = NEW.member_id;
  IF v_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, branch_id, title, message, type, category, action_url)
    VALUES (v_user, v_branch, 'New posture scan ready',
            'Your latest HOWBODY posture report is now in your Progress tab.',
            'success', 'progress', '/my-progress');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_howbody_notify_posture ON public.howbody_posture_reports;
CREATE TRIGGER trg_howbody_notify_posture
AFTER INSERT ON public.howbody_posture_reports
FOR EACH ROW EXECUTE FUNCTION public.howbody_notify_member_posture();
