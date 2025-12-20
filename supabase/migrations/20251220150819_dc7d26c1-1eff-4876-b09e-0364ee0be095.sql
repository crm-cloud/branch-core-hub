-- Function to validate membership for check-in
CREATE OR REPLACE FUNCTION public.validate_member_checkin(_member_id UUID, _branch_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership RECORD;
  v_open_attendance RECORD;
BEGIN
  -- Check for open attendance (already checked in)
  SELECT * INTO v_open_attendance
  FROM public.member_attendance
  WHERE member_id = _member_id
    AND check_out IS NULL
  ORDER BY check_in DESC
  LIMIT 1;
  
  IF FOUND THEN
    RETURN json_build_object(
      'valid', false,
      'reason', 'already_checked_in',
      'message', 'Member is already checked in',
      'attendance_id', v_open_attendance.id,
      'check_in_time', v_open_attendance.check_in
    );
  END IF;

  -- Check for active membership at branch
  SELECT m.*, mp.name as plan_name INTO v_membership
  FROM public.memberships m
  JOIN public.membership_plans mp ON m.plan_id = mp.id
  WHERE m.member_id = _member_id
    AND m.status = 'active'
    AND m.branch_id = _branch_id
    AND CURRENT_DATE BETWEEN m.start_date AND m.end_date
  LIMIT 1;
  
  IF NOT FOUND THEN
    SELECT m.*, mp.name as plan_name INTO v_membership
    FROM public.memberships m
    JOIN public.membership_plans mp ON m.plan_id = mp.id
    WHERE m.member_id = _member_id
    ORDER BY m.end_date DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
      RETURN json_build_object(
        'valid', false,
        'reason', 'no_membership',
        'message', 'No membership found for this member'
      );
    ELSIF v_membership.end_date < CURRENT_DATE THEN
      RETURN json_build_object(
        'valid', false,
        'reason', 'expired',
        'message', 'Membership expired on ' || v_membership.end_date::TEXT
      );
    ELSIF v_membership.branch_id != _branch_id THEN
      RETURN json_build_object(
        'valid', false,
        'reason', 'wrong_branch',
        'message', 'Membership is for a different branch'
      );
    ELSIF v_membership.status = 'frozen' THEN
      RETURN json_build_object(
        'valid', false,
        'reason', 'frozen',
        'message', 'Membership is currently frozen'
      );
    ELSE
      RETURN json_build_object(
        'valid', false,
        'reason', 'inactive',
        'message', 'Membership is not active'
      );
    END IF;
  END IF;
  
  RETURN json_build_object(
    'valid', true,
    'membership_id', v_membership.id,
    'plan_name', v_membership.plan_name,
    'end_date', v_membership.end_date,
    'days_remaining', v_membership.end_date - CURRENT_DATE
  );
END;
$$;

-- Function to perform check-in
CREATE OR REPLACE FUNCTION public.member_check_in(_member_id UUID, _branch_id UUID, _method TEXT DEFAULT 'manual')
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validation JSON;
  v_attendance_id UUID;
BEGIN
  v_validation := public.validate_member_checkin(_member_id, _branch_id);
  
  IF NOT (v_validation->>'valid')::BOOLEAN THEN
    RETURN v_validation;
  END IF;
  
  INSERT INTO public.member_attendance (member_id, membership_id, branch_id, check_in, check_in_method)
  VALUES (_member_id, (v_validation->>'membership_id')::UUID, _branch_id, now(), _method)
  RETURNING id INTO v_attendance_id;
  
  RETURN json_build_object(
    'valid', true,
    'success', true,
    'attendance_id', v_attendance_id,
    'message', 'Check-in successful',
    'plan_name', v_validation->>'plan_name',
    'days_remaining', (v_validation->>'days_remaining')::INTEGER
  );
END;
$$;

-- Function to perform check-out
CREATE OR REPLACE FUNCTION public.member_check_out(_member_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attendance RECORD;
BEGIN
  SELECT * INTO v_attendance
  FROM public.member_attendance
  WHERE member_id = _member_id
    AND check_out IS NULL
  ORDER BY check_in DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'No active check-in found'
    );
  END IF;
  
  UPDATE public.member_attendance
  SET check_out = now()
  WHERE id = v_attendance.id;
  
  RETURN json_build_object(
    'success', true,
    'attendance_id', v_attendance.id,
    'check_in', v_attendance.check_in,
    'check_out', now(),
    'duration_minutes', EXTRACT(EPOCH FROM (now() - v_attendance.check_in)) / 60
  );
END;
$$;