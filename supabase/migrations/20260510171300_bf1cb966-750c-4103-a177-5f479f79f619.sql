CREATE OR REPLACE FUNCTION public.compute_payroll(p_user_id uuid, p_period_start date, p_period_end date, p_run_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(work_date date, status text, hours_worked numeric, ot_hours numeric, is_late boolean, is_early_out boolean, is_missing_checkout boolean, is_half_day boolean, is_holiday boolean, is_weekly_off boolean, leave_type text, payable boolean, notes text)
 LANGUAGE plpgsql
 STABLE
 SET search_path = public
AS $function$
DECLARE
  v_d date;
  v_dow int;
  v_shift RECORD;
  v_shift_start time; v_shift_end time;
  v_shift_hours numeric;
  v_grace int;
  v_half_th numeric;
  v_ot_th numeric;
  v_first_in timestamptz;
  v_last_out timestamptz;
  v_total_seconds numeric;
  v_hours numeric;
  v_status text;
  v_late boolean; v_early boolean; v_missing boolean; v_half boolean;
  v_ot numeric; v_holiday boolean; v_weekly_off boolean;
  v_leave text; v_payable boolean; v_notes text;
  v_holiday_mult numeric;
BEGIN
  v_d := p_period_start;
  WHILE v_d <= p_period_end LOOP
    v_dow := EXTRACT(DOW FROM v_d);
    v_late := false; v_early := false; v_missing := false; v_half := false;
    v_ot := 0; v_holiday := false; v_weekly_off := false;
    v_leave := NULL; v_payable := true; v_notes := NULL; v_hours := 0;
    v_holiday_mult := 1.0;

    SELECT * INTO v_shift FROM public.staff_shifts ss WHERE ss.user_id = p_user_id AND ss.weekday = v_dow LIMIT 1;
    IF FOUND THEN
      v_shift_start := v_shift.start_time;
      v_shift_end := v_shift.end_time;
      v_grace := v_shift.late_grace_min;
      v_half_th := v_shift.half_day_threshold_hours;
      v_ot_th := v_shift.ot_threshold_hours;
      v_weekly_off := v_shift.is_weekly_off;
    ELSE
      v_shift_start := '09:00'::time;
      v_shift_end := '18:00'::time;
      v_grace := 15;
      v_half_th := 4;
      v_ot_th := 8.5;
      v_weekly_off := (v_dow = 0);
    END IF;
    v_shift_hours := EXTRACT(EPOCH FROM (v_shift_end - v_shift_start))/3600.0;

    SELECT true, COALESCE(h.pay_multiplier,1.0) INTO v_holiday, v_holiday_mult
      FROM public.holidays h WHERE h.holiday_date = v_d
        AND (h.branch_id IS NULL OR h.branch_id = (SELECT ss2.branch_id FROM public.staff_shifts ss2 WHERE ss2.user_id = p_user_id LIMIT 1))
      LIMIT 1;
    v_holiday := COALESCE(v_holiday, false);

    SELECT lr.leave_type INTO v_leave FROM public.leave_requests lr
      WHERE lr.user_id = p_user_id AND lr.status='approved' AND v_d BETWEEN lr.start_date AND lr.end_date LIMIT 1;

    SELECT MIN(sa.check_in), MAX(COALESCE(sa.check_out, sa.check_in)),
           COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(sa.check_out, sa.check_in) - sa.check_in))), 0)
      INTO v_first_in, v_last_out, v_total_seconds
      FROM public.staff_attendance sa
     WHERE sa.user_id = p_user_id AND sa.check_in::date = v_d;

    IF v_first_in IS NOT NULL THEN
      v_hours := round(LEAST(v_total_seconds/3600.0, 24), 2);
      IF v_last_out IS NULL OR v_last_out = v_first_in THEN
        v_missing := true;
        v_notes := 'missing_checkout';
      END IF;
      IF EXTRACT(EPOCH FROM (v_first_in::time - v_shift_start))/60.0 > v_grace THEN
        v_late := true;
      END IF;
      IF NOT v_missing AND v_last_out::time < v_shift_end THEN
        v_early := true;
      END IF;
      IF v_hours < v_half_th THEN v_half := true; END IF;
      IF v_hours > v_ot_th THEN v_ot := round(v_hours - v_ot_th, 2); END IF;

      v_status := CASE
        WHEN v_missing THEN 'present_missing_out'
        WHEN v_half THEN 'half_day'
        ELSE 'present'
      END;

      IF v_holiday AND v_holiday_mult > 1 THEN
        v_notes := COALESCE(v_notes||'; ','') || format('holiday_pay_x%s', v_holiday_mult);
      END IF;

    ELSIF v_holiday THEN
      v_status := 'holiday'; v_payable := true; v_notes := 'paid_holiday';
    ELSIF v_weekly_off THEN
      v_status := 'weekly_off'; v_payable := true;
    ELSIF v_leave IS NOT NULL THEN
      v_status := 'leave';
      v_payable := (v_leave IN ('paid','sick','earned','comp_off'));
      v_notes := v_leave;
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
$function$;