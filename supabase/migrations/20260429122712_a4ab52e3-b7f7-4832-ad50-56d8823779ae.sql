-- 1) Drop dedicated scanner columns on membership_plans (introduced in previous step, not in production use)
ALTER TABLE public.membership_plans
  DROP COLUMN IF EXISTS body_scan_allowed,
  DROP COLUMN IF EXISTS posture_scan_allowed,
  DROP COLUMN IF EXISTS scans_per_month;

-- 2) Rename existing 3D Body Scanning benefit type and seed Posture Scan for every branch
UPDATE public.benefit_types
   SET name = 'Body Composition Scan',
       description = COALESCE(description, 'HOWBODY body composition assessment'),
       icon = COALESCE(icon, 'Scan'),
       category = 'service'
 WHERE code = '3d_body_scanning';

INSERT INTO public.benefit_types (branch_id, name, code, description, icon, is_bookable, is_active, category)
SELECT b.id, 'Posture Scan', 'howbody_posture',
       'HOWBODY posture and body alignment assessment', 'PersonStanding',
       false, true, 'service'
  FROM public.branches b
 WHERE NOT EXISTS (
   SELECT 1 FROM public.benefit_types bt
    WHERE bt.branch_id = b.id AND bt.code = 'howbody_posture'
 );

-- Also ensure every branch has a Body Composition Scan type
INSERT INTO public.benefit_types (branch_id, name, code, description, icon, is_bookable, is_active, category)
SELECT b.id, 'Body Composition Scan', '3d_body_scanning',
       'HOWBODY body composition assessment', 'Scan',
       false, true, 'service'
  FROM public.branches b
 WHERE NOT EXISTS (
   SELECT 1 FROM public.benefit_types bt
    WHERE bt.branch_id = b.id AND bt.code = '3d_body_scanning'
 );

-- 3) Rewrite quota function to read from plan_benefits + member_benefit_credits via benefit_type_id
CREATE OR REPLACE FUNCTION public.howbody_scan_quota(_member_id uuid, _kind text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := CASE WHEN _kind = 'posture' THEN 'howbody_posture' ELSE '3d_body_scanning' END;
  v_branch uuid;
  v_benefit_type_id uuid;
  v_plan_id uuid;
  v_plan_limit int := 0;          -- 0 = no allowance from plan; -1 = unlimited
  v_plan_freq text;
  v_used_this_period int := 0;
  v_used_this_month int := 0;
  v_addon_remaining int := 0;
  v_period_start timestamptz;
  v_month_start timestamptz := date_trunc('month', now());
  v_plan_remaining int := 0;
BEGIN
  -- Find member's branch + active membership
  SELECT m.branch_id INTO v_branch FROM public.members m WHERE m.id = _member_id;

  SELECT mp.id, mb.id INTO v_plan_id, v_benefit_type_id
  FROM public.memberships mb
  JOIN public.membership_plans mp ON mp.id = mb.plan_id
  WHERE mb.member_id = _member_id
    AND mb.status = 'active'
    AND mb.end_date >= CURRENT_DATE
  ORDER BY mb.end_date DESC
  LIMIT 1;

  -- Resolve the benefit type id for this branch
  SELECT bt.id INTO v_benefit_type_id
    FROM public.benefit_types bt
   WHERE bt.code = v_code AND bt.branch_id = v_branch
   LIMIT 1;

  -- Plan allowance
  IF v_plan_id IS NOT NULL AND v_benefit_type_id IS NOT NULL THEN
    SELECT COALESCE(SUM(pb.limit_count), 0), MIN(pb.frequency)
      INTO v_plan_limit, v_plan_freq
      FROM public.plan_benefits pb
     WHERE pb.plan_id = v_plan_id
       AND pb.benefit_type_id = v_benefit_type_id;
  END IF;

  -- Determine usage period based on frequency
  v_period_start := CASE
    WHEN v_plan_freq = 'monthly' THEN v_month_start
    WHEN v_plan_freq = 'weekly' THEN date_trunc('week', now())
    WHEN v_plan_freq = 'daily' THEN date_trunc('day', now())
    ELSE NULL  -- per_membership / one_time / null = lifetime since membership
  END;

  IF _kind = 'posture' THEN
    SELECT COUNT(*) INTO v_used_this_period
      FROM public.howbody_posture_reports
     WHERE member_id = _member_id
       AND (v_period_start IS NULL OR created_at >= v_period_start);
    SELECT COUNT(*) INTO v_used_this_month
      FROM public.howbody_posture_reports
     WHERE member_id = _member_id AND created_at >= v_month_start;
  ELSE
    SELECT COUNT(*) INTO v_used_this_period
      FROM public.howbody_body_reports
     WHERE member_id = _member_id
       AND (v_period_start IS NULL OR created_at >= v_period_start);
    SELECT COUNT(*) INTO v_used_this_month
      FROM public.howbody_body_reports
     WHERE member_id = _member_id AND created_at >= v_month_start;
  END IF;

  -- Add-on credits via benefit_type_id (preferred) OR legacy enum match
  IF v_benefit_type_id IS NOT NULL THEN
    SELECT COALESCE(SUM(credits_remaining), 0) INTO v_addon_remaining
      FROM public.member_benefit_credits
     WHERE member_id = _member_id
       AND benefit_type_id = v_benefit_type_id
       AND credits_remaining > 0
       AND (expires_at IS NULL OR expires_at > now());
  END IF;

  v_plan_remaining := GREATEST(0, COALESCE(v_plan_limit,0) - v_used_this_period);

  RETURN jsonb_build_object(
    'kind', _kind,
    'benefit_code', v_code,
    'plan_limit', COALESCE(v_plan_limit, 0),
    'plan_frequency', v_plan_freq,
    'used_this_period', v_used_this_period,
    'used_this_month', v_used_this_month,
    'plan_remaining', v_plan_remaining,
    'addon_remaining', v_addon_remaining,
    'allowed', (v_plan_remaining > 0) OR (v_addon_remaining > 0),
    'reason', CASE
      WHEN COALESCE(v_plan_limit,0) = 0 AND v_addon_remaining = 0 THEN 'plan_no_scan'
      WHEN v_plan_remaining = 0 AND v_addon_remaining = 0 THEN 'period_limit'
      ELSE 'ok'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.howbody_scan_quota(uuid, text) TO authenticated, anon, service_role;

-- 4) Helper: consume one add-on credit only if plan allowance is exhausted (FIFO)
CREATE OR REPLACE FUNCTION public.consume_scan_credit_if_needed(_member_id uuid, _kind text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quota jsonb;
  v_credit_id uuid;
BEGIN
  v_quota := public.howbody_scan_quota(_member_id, _kind);
  IF (v_quota->>'plan_remaining')::int > 0 THEN
    RETURN false;  -- covered by plan
  END IF;
  IF (v_quota->>'addon_remaining')::int <= 0 THEN
    RETURN false;  -- nothing to consume
  END IF;

  SELECT mbc.id INTO v_credit_id
    FROM public.member_benefit_credits mbc
    JOIN public.benefit_types bt ON bt.id = mbc.benefit_type_id
   WHERE mbc.member_id = _member_id
     AND bt.code = CASE WHEN _kind='posture' THEN 'howbody_posture' ELSE '3d_body_scanning' END
     AND mbc.credits_remaining > 0
     AND (mbc.expires_at IS NULL OR mbc.expires_at > now())
   ORDER BY COALESCE(mbc.expires_at, 'infinity'::timestamptz) ASC, mbc.purchased_at ASC
   LIMIT 1
   FOR UPDATE;

  IF v_credit_id IS NULL THEN RETURN false; END IF;

  UPDATE public.member_benefit_credits
     SET credits_remaining = credits_remaining - 1,
         updated_at = now()
   WHERE id = v_credit_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_scan_credit_if_needed(uuid, text) TO authenticated, service_role;

-- 5) Fix posture mirror trigger (previous version referenced non-existent columns)
CREATE OR REPLACE FUNCTION public.howbody_mirror_posture_to_measurements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recorded_at timestamptz := COALESCE(NEW.test_time, NEW.created_at, now());
  v_posture_summary text;
BEGIN
  v_posture_summary := CASE
    WHEN ABS(COALESCE(NEW.head_forward,0)) > 5 THEN 'Forward head posture'
    WHEN ABS(COALESCE(NEW.high_low_shoulder,0)) > 1 THEN 'Uneven shoulders'
    WHEN ABS(COALESCE(NEW.pelvis_forward,0)) > 5 THEN 'Anterior pelvic tilt'
    ELSE 'Neutral / balanced'
  END;
  INSERT INTO public.member_measurements
    (member_id, recorded_at, posture_type, notes, waist_cm, hips_cm, chest_cm)
  VALUES
    (NEW.member_id, v_recorded_at, v_posture_summary,
     'HOWBODY auto-sync (posture)',
     NEW.waist, NEW.hip, NEW.bust);
  -- After mirror, attempt add-on consumption if plan exhausted
  PERFORM public.consume_scan_credit_if_needed(NEW.member_id, 'posture');
  RETURN NEW;
END;
$$;

-- 6) Patch body mirror trigger to also call consume helper
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
  PERFORM public.consume_scan_credit_if_needed(NEW.member_id, 'body');
  RETURN NEW;
END;
$$;
