
-- Create SECURITY DEFINER function for server-side slot generation
-- This bypasses RLS so members can trigger slot creation
CREATE OR REPLACE FUNCTION public.ensure_facility_slots(
  p_branch_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_facility RECORD;
  v_settings RECORD;
  v_current_date DATE;
  v_day_abbr TEXT;
  v_start_time TIME;
  v_end_time TIME;
  v_duration INT;
  v_buffer INT;
  v_capacity INT;
  v_slot_start TIME;
  v_slot_end TIME;
  v_safe_bt TEXT;
BEGIN
  -- Loop over each active, non-maintenance facility for this branch
  FOR v_facility IN
    SELECT f.id, f.benefit_type_id, f.capacity AS fac_capacity,
           COALESCE(f.available_days, ARRAY['mon','tue','wed','thu','fri','sat','sun']) AS available_days
    FROM facilities f
    WHERE f.branch_id = p_branch_id
      AND f.is_active = true
      AND COALESCE(f.under_maintenance, false) = false
  LOOP
    -- Find matching benefit_settings for this facility's benefit_type_id
    SELECT bs.operating_hours_start, bs.operating_hours_end,
           bs.slot_duration_minutes, bs.buffer_between_sessions_minutes,
           bs.capacity_per_slot, bs.is_slot_booking_enabled,
           bs.benefit_type
    INTO v_settings
    FROM benefit_settings bs
    WHERE bs.branch_id = p_branch_id
      AND bs.benefit_type_id = v_facility.benefit_type_id
    LIMIT 1;

    -- If settings explicitly disable slot booking, skip
    IF v_settings IS NOT NULL AND v_settings.is_slot_booking_enabled = false THEN
      CONTINUE;
    END IF;

    -- Use settings or defaults
    v_start_time := COALESCE(v_settings.operating_hours_start, '06:00:00')::TIME;
    v_end_time := COALESCE(v_settings.operating_hours_end, '22:00:00')::TIME;
    v_duration := COALESCE(v_settings.slot_duration_minutes, 30);
    v_buffer := COALESCE(v_settings.buffer_between_sessions_minutes, 0);
    v_capacity := COALESCE(v_facility.fac_capacity, v_settings.capacity_per_slot, 1);
    v_safe_bt := COALESCE(v_settings.benefit_type::TEXT, 'other');

    -- Loop over each date in the range
    v_current_date := p_start_date;
    WHILE v_current_date <= p_end_date LOOP
      -- Get day abbreviation (mon, tue, etc.)
      v_day_abbr := LOWER(LEFT(TO_CHAR(v_current_date, 'Dy'), 3));

      -- Check if this day is in available_days
      IF v_day_abbr = ANY(v_facility.available_days) THEN
        -- Check if slots already exist for this facility+date
        IF NOT EXISTS (
          SELECT 1 FROM benefit_slots
          WHERE facility_id = v_facility.id
            AND slot_date = v_current_date::TEXT
            AND is_active = true
        ) THEN
          -- Generate time slots
          v_slot_start := v_start_time;
          WHILE v_slot_start + (v_duration || ' minutes')::INTERVAL <= v_end_time LOOP
            v_slot_end := v_slot_start + (v_duration || ' minutes')::INTERVAL;

            INSERT INTO benefit_slots (
              branch_id, benefit_type, benefit_type_id, facility_id,
              slot_date, start_time, end_time, capacity, is_active
            ) VALUES (
              p_branch_id,
              v_safe_bt::benefit_type,
              v_facility.benefit_type_id,
              v_facility.id,
              v_current_date::TEXT,
              v_slot_start::TEXT,
              v_slot_end::TEXT,
              v_capacity,
              true
            );

            v_slot_start := v_slot_end + (v_buffer || ' minutes')::INTERVAL;
          END LOOP;
        END IF;
      END IF;

      v_current_date := v_current_date + 1;
    END LOOP;
  END LOOP;
END;
$$;
