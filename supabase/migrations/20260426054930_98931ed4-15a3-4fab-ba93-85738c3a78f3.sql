
-- ============================================================
-- 1. Helper: notify-booking-event dispatcher (pg_net fire-and-forget)
-- ============================================================
CREATE OR REPLACE FUNCTION public._notify_booking_event(
  p_event TEXT,
  p_booking_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT := 'https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/notify-booking-event';
  v_anon TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5cXFwYnZuc3p5cnJnZXJuaW9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzE1NjIsImV4cCI6MjA4MTgwNzU2Mn0.EAmMC21oRiyV8sgixS8eQE3-b17_-Y9kn2-os8fv0Eo';
BEGIN
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon),
    body := jsonb_build_object('event', p_event, 'booking_id', p_booking_id)
  );
EXCEPTION WHEN OTHERS THEN
  -- Never block the booking on notification failure
  RAISE WARNING 'notify-booking-event dispatch failed: %', SQLERRM;
END;
$$;

-- ============================================================
-- 2. Hardened book_facility_slot
-- ============================================================
CREATE OR REPLACE FUNCTION public.book_facility_slot(
  p_slot_id UUID,
  p_member_id UUID,
  p_membership_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot RECORD;
  v_facility RECORD;
  v_settings RECORD;
  v_member_gender TEXT;
  v_plan_benefit RECORD;
  v_existing_count INTEGER;
  v_today_count INTEGER;
  v_slot_dt TIMESTAMPTZ;
  v_window_hours INTEGER;
  v_booking_id UUID;
BEGIN
  -- 1. Lock slot
  SELECT * INTO v_slot FROM benefit_slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot not found');
  END IF;

  IF v_slot.is_active = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'This slot is no longer available');
  END IF;

  -- 2. Capacity
  IF (v_slot.booked_count >= v_slot.capacity) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This slot is fully booked');
  END IF;

  -- 3. Facility checks (maintenance + gender)
  IF v_slot.facility_id IS NOT NULL THEN
    SELECT * INTO v_facility FROM facilities WHERE id = v_slot.facility_id;
    IF FOUND THEN
      IF COALESCE(v_facility.under_maintenance, false) = true THEN
        RETURN jsonb_build_object('success', false, 'error', 'This facility is under maintenance');
      END IF;
      IF COALESCE(v_facility.is_active, true) = false THEN
        RETURN jsonb_build_object('success', false, 'error', 'This facility is currently disabled');
      END IF;

      IF COALESCE(v_facility.gender_access, 'unisex') <> 'unisex' THEN
        SELECT p.gender INTO v_member_gender
        FROM members m JOIN profiles p ON p.id = m.user_id
        WHERE m.id = p_member_id;
        IF v_member_gender IS NOT NULL AND v_member_gender <> v_facility.gender_access THEN
          RETURN jsonb_build_object('success', false, 'error',
            'This facility is reserved for ' || v_facility.gender_access || ' members only');
        END IF;
      END IF;
    END IF;
  END IF;

  -- 4. Booking-window enforcement (booking_opens_hours_before)
  IF v_slot.benefit_type_id IS NOT NULL THEN
    SELECT * INTO v_settings
    FROM benefit_settings
    WHERE branch_id = v_slot.branch_id
      AND benefit_type_id = v_slot.benefit_type_id
    LIMIT 1;

    v_slot_dt := (v_slot.slot_date::TEXT || ' ' || v_slot.start_time::TEXT)::TIMESTAMPTZ;
    v_window_hours := COALESCE(v_settings.booking_opens_hours_before, 24);

    IF v_slot_dt > now() + (v_window_hours || ' hours')::INTERVAL THEN
      RETURN jsonb_build_object('success', false, 'error',
        'Booking opens ' || v_window_hours || ' hours before the slot. Please try again closer to the date.');
    END IF;

    IF v_slot_dt < now() THEN
      RETURN jsonb_build_object('success', false, 'error', 'This slot has already started');
    END IF;

    -- 5. Max bookings per day (per benefit_type for this member)
    IF COALESCE(v_settings.max_bookings_per_day, 0) > 0 THEN
      SELECT COUNT(*) INTO v_today_count
      FROM benefit_bookings bb
      JOIN benefit_slots bs ON bs.id = bb.slot_id
      WHERE bb.member_id = p_member_id
        AND bs.benefit_type_id = v_slot.benefit_type_id
        AND bs.slot_date = v_slot.slot_date
        AND bb.status IN ('booked', 'confirmed');
      IF v_today_count >= v_settings.max_bookings_per_day THEN
        RETURN jsonb_build_object('success', false, 'error',
          'Daily booking limit reached (' || v_today_count || '/' || v_settings.max_bookings_per_day || ') for this benefit');
      END IF;
    END IF;
  END IF;

  -- 6. Duplicate guard
  IF EXISTS (
    SELECT 1 FROM benefit_bookings
    WHERE slot_id = p_slot_id AND member_id = p_member_id
      AND status IN ('booked', 'confirmed')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a booking for this slot');
  END IF;

  -- 7. Plan-benefit limit (preserved from previous version)
  IF v_slot.benefit_type_id IS NOT NULL THEN
    SELECT pb.* INTO v_plan_benefit
    FROM plan_benefits pb
    JOIN memberships m ON m.plan_id = pb.plan_id
    WHERE m.id = p_membership_id AND pb.benefit_type_id = v_slot.benefit_type_id
    LIMIT 1;

    IF FOUND
       AND v_plan_benefit.limit_count IS NOT NULL
       AND v_plan_benefit.limit_count > 0
       AND v_plan_benefit.frequency IS DISTINCT FROM 'unlimited' THEN
      SELECT COUNT(*) INTO v_existing_count
      FROM benefit_bookings bb
      JOIN benefit_slots bs ON bs.id = bb.slot_id
      WHERE bb.member_id = p_member_id
        AND bb.membership_id = p_membership_id
        AND bs.benefit_type_id = v_slot.benefit_type_id
        AND bb.status IN ('booked', 'confirmed')
        AND CASE v_plan_benefit.frequency
          WHEN 'per_membership' THEN TRUE
          WHEN 'monthly' THEN bs.slot_date >= date_trunc('month', CURRENT_DATE)
          WHEN 'weekly'  THEN bs.slot_date >= date_trunc('week',  CURRENT_DATE)
          WHEN 'daily'   THEN bs.slot_date  = CURRENT_DATE
          ELSE TRUE
        END;
      IF v_existing_count >= v_plan_benefit.limit_count THEN
        RETURN jsonb_build_object('success', false, 'error',
          'Benefit limit reached (' || v_existing_count || '/' || v_plan_benefit.limit_count || '). Please purchase an add-on.');
      END IF;
    END IF;
  END IF;

  -- 8. Insert
  INSERT INTO benefit_bookings (slot_id, member_id, membership_id, status)
  VALUES (p_slot_id, p_member_id, p_membership_id, 'booked')
  RETURNING id INTO v_booking_id;

  IF v_slot.benefit_type_id IS NOT NULL THEN
    INSERT INTO benefit_usage (membership_id, benefit_type, benefit_type_id, usage_date, usage_count)
    VALUES (p_membership_id, v_slot.benefit_type, v_slot.benefit_type_id, CURRENT_DATE, 1);
  END IF;

  -- 9. Fire notification
  PERFORM public._notify_booking_event('facility_slot_booked', v_booking_id);

  RETURN jsonb_build_object('success', true, 'booking_id', v_booking_id);
END;
$$;

-- ============================================================
-- 3. Hardened cancel_facility_slot (enforces cancellation deadline)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_facility_slot(
  p_booking_id UUID,
  p_reason TEXT DEFAULT 'Cancelled by member'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_slot RECORD;
  v_settings RECORD;
  v_slot_dt TIMESTAMPTZ;
  v_deadline_min INTEGER;
BEGIN
  SELECT * INTO v_booking FROM benefit_bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;
  IF v_booking.status NOT IN ('booked', 'confirmed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking is already ' || v_booking.status);
  END IF;

  SELECT * INTO v_slot FROM benefit_slots WHERE id = v_booking.slot_id;
  IF FOUND AND v_slot.benefit_type_id IS NOT NULL THEN
    SELECT * INTO v_settings
    FROM benefit_settings
    WHERE branch_id = v_slot.branch_id AND benefit_type_id = v_slot.benefit_type_id
    LIMIT 1;

    v_slot_dt := (v_slot.slot_date::TEXT || ' ' || v_slot.start_time::TEXT)::TIMESTAMPTZ;
    v_deadline_min := COALESCE(v_settings.cancellation_deadline_minutes, 60);

    IF v_slot_dt - now() < (v_deadline_min || ' minutes')::INTERVAL
       AND p_reason NOT LIKE 'STAFF_OVERRIDE%' THEN
      RETURN jsonb_build_object('success', false, 'error',
        'Cancellation window closed (must cancel ' || v_deadline_min || ' minutes before the slot). Please contact staff.');
    END IF;
  END IF;

  UPDATE benefit_bookings
  SET status = 'cancelled', cancelled_at = now(), cancellation_reason = p_reason
  WHERE id = p_booking_id;

  -- Refund usage
  IF v_slot.benefit_type_id IS NOT NULL THEN
    DELETE FROM benefit_usage
    WHERE id = (
      SELECT id FROM benefit_usage
      WHERE membership_id = v_booking.membership_id
        AND benefit_type_id = v_slot.benefit_type_id
        AND usage_count = 1
      ORDER BY created_at DESC LIMIT 1
    );
  END IF;

  PERFORM public._notify_booking_event('facility_slot_cancelled', p_booking_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 4. Seed new whatsapp_triggers events for every branch
-- ============================================================
INSERT INTO whatsapp_triggers (branch_id, event_name, is_active, delay_minutes)
SELECT b.id, ev.event_name, true, 0
FROM branches b
CROSS JOIN (VALUES ('facility_slot_booked'), ('facility_slot_cancelled')) AS ev(event_name)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. Auto no-show marker
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_no_show_bookings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  WITH overdue AS (
    SELECT bb.id
    FROM benefit_bookings bb
    JOIN benefit_slots bs ON bs.id = bb.slot_id
    WHERE bb.status = 'booked'
      AND bb.check_in_at IS NULL
      AND (bs.slot_date::TEXT || ' ' || bs.end_time::TEXT)::TIMESTAMPTZ < now() - INTERVAL '30 minutes'
  ), updated AS (
    UPDATE benefit_bookings
    SET status = 'no_show', no_show_marked_at = now()
    WHERE id IN (SELECT id FROM overdue)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

-- ============================================================
-- 6. Schedule cron jobs
-- ============================================================
DO $$
BEGIN
  -- Remove any old versions
  PERFORM cron.unschedule(jobid) FROM cron.job
  WHERE jobname IN ('mark-no-show-bookings', 'benefit-t2h-reminders');

  -- 6a. No-show marker every 15 minutes
  PERFORM cron.schedule(
    'mark-no-show-bookings',
    '*/15 * * * *',
    $cron$ SELECT public.mark_no_show_bookings(); $cron$
  );

  -- 6b. T-2h benefit reminders every 30 minutes
  PERFORM cron.schedule(
    'benefit-t2h-reminders',
    '*/30 * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/send-reminders',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5cXFwYnZuc3p5cnJnZXJuaW9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzE1NjIsImV4cCI6MjA4MTgwNzU2Mn0.EAmMC21oRiyV8sgixS8eQE3-b17_-Y9kn2-os8fv0Eo"}'::jsonb,
      body := '{"mode":"benefit_t2h"}'::jsonb
    ) AS request_id;
    $cron$
  );
END $$;
