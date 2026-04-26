
-- ============================================================
-- 1. Extend benefit_bookings with attribution columns
-- ============================================================
ALTER TABLE public.benefit_bookings
  ADD COLUMN IF NOT EXISTS booked_by_staff_id uuid,
  ADD COLUMN IF NOT EXISTS cancelled_by_staff_id uuid,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'member_portal',
  ADD COLUMN IF NOT EXISTS force_added boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS force_reason text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='benefit_bookings_source_check') THEN
    ALTER TABLE public.benefit_bookings
      ADD CONSTRAINT benefit_bookings_source_check
      CHECK (source IN ('member_portal','concierge','whatsapp_ai','admin','system'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_benefit_bookings_booked_by ON public.benefit_bookings(booked_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_benefit_bookings_source ON public.benefit_bookings(source);

-- ============================================================
-- 2. Booking audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.booking_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.benefit_bookings(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  actor_id uuid,
  actor_role text,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_audit_booking ON public.booking_audit_log(booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_audit_actor ON public.booking_audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_audit_created ON public.booking_audit_log(created_at DESC);

ALTER TABLE public.booking_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view their own booking audit" ON public.booking_audit_log;
CREATE POLICY "Members view their own booking audit"
  ON public.booking_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.benefit_bookings b
      JOIN public.members m ON m.id = b.member_id
      WHERE b.id = booking_audit_log.booking_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff view branch booking audit" ON public.booking_audit_log;
CREATE POLICY "Staff view branch booking audit"
  ON public.booking_audit_log FOR SELECT
  USING (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'owner') OR
    public.has_role(auth.uid(),'manager') OR
    public.has_role(auth.uid(),'staff')
  );

DROP POLICY IF EXISTS "System can insert booking audit" ON public.booking_audit_log;
CREATE POLICY "System can insert booking audit"
  ON public.booking_audit_log FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 3. Trigger: auto-log booking status changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_booking_status_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_actor_role text;
  v_event text;
  v_reason text;
  v_meta jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_actor := COALESCE(NEW.booked_by_staff_id, auth.uid());
    v_actor_role := CASE
      WHEN NEW.booked_by_staff_id IS NOT NULL THEN 'staff'
      WHEN NEW.source = 'system' THEN 'system'
      WHEN NEW.source = 'whatsapp_ai' THEN 'ai'
      ELSE 'member'
    END;
    v_event := CASE WHEN NEW.force_added THEN 'force_added' ELSE 'created' END;
    v_meta := jsonb_build_object(
      'source', NEW.source,
      'force_added', NEW.force_added,
      'force_reason', NEW.force_reason
    );
    INSERT INTO public.booking_audit_log
      (booking_id, event_type, from_status, to_status, actor_id, actor_role, reason, metadata)
    VALUES
      (NEW.id, v_event, NULL, NEW.status::text, v_actor, v_actor_role, NEW.force_reason, v_meta);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := CASE NEW.status::text
      WHEN 'cancelled' THEN 'cancelled'
      WHEN 'no_show' THEN 'no_show'
      WHEN 'attended' THEN 'checked_in'
      WHEN 'completed' THEN 'completed'
      ELSE 'status_change'
    END;
    v_actor := COALESCE(NEW.cancelled_by_staff_id, auth.uid());
    v_actor_role := CASE
      WHEN NEW.cancelled_by_staff_id IS NOT NULL THEN 'staff'
      WHEN auth.uid() IS NULL THEN 'system'
      ELSE 'member'
    END;
    v_reason := NEW.cancellation_reason;
    v_meta := jsonb_build_object('source', NEW.source);
    INSERT INTO public.booking_audit_log
      (booking_id, event_type, from_status, to_status, actor_id, actor_role, reason, metadata)
    VALUES
      (NEW.id, v_event, OLD.status::text, NEW.status::text, v_actor, v_actor_role, v_reason, v_meta);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_status_audit ON public.benefit_bookings;
CREATE TRIGGER trg_booking_status_audit
AFTER INSERT OR UPDATE OF status ON public.benefit_bookings
FOR EACH ROW EXECUTE FUNCTION public.fn_booking_status_audit();

-- ============================================================
-- 4. Hardened book_facility_slot RPC
-- ============================================================
DROP FUNCTION IF EXISTS public.book_facility_slot(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.book_facility_slot(uuid, uuid, uuid, uuid, text, boolean, text);

CREATE OR REPLACE FUNCTION public.book_facility_slot(
  p_slot_id uuid,
  p_member_id uuid,
  p_membership_id uuid,
  p_staff_id uuid DEFAULT NULL,
  p_source text DEFAULT 'member_portal',
  p_force boolean DEFAULT false,
  p_force_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot RECORD;
  v_facility RECORD;
  v_settings RECORD;
  v_member_gender text;
  v_existing_count integer;
  v_today_count integer;
  v_slot_dt timestamptz;
  v_window_hours integer;
  v_booking_id uuid;
  v_is_privileged boolean := false;
BEGIN
  -- Validate source
  IF p_source NOT IN ('member_portal','concierge','whatsapp_ai','admin','system') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid source');
  END IF;

  -- If forcing, verify caller has elevated role
  IF p_force THEN
    IF p_staff_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Force-add requires staff identity');
    END IF;
    SELECT (public.has_role(p_staff_id,'admin') OR public.has_role(p_staff_id,'owner') OR public.has_role(p_staff_id,'manager'))
      INTO v_is_privileged;
    IF NOT v_is_privileged THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only admin/owner/manager can force-add bookings');
    END IF;
  END IF;

  -- 1. Lock slot
  SELECT * INTO v_slot FROM benefit_slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot not found');
  END IF;

  IF v_slot.is_active = false AND NOT p_force THEN
    RETURN jsonb_build_object('success', false, 'error', 'This slot is no longer available');
  END IF;

  -- Capacity check (skip if forced)
  IF NOT p_force AND v_slot.booked_count >= v_slot.capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot is full');
  END IF;

  -- 2. Already booked?
  SELECT count(*) INTO v_existing_count
    FROM benefit_bookings
    WHERE slot_id = p_slot_id
      AND member_id = p_member_id
      AND status IN ('booked','attended');
  IF v_existing_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member already booked for this slot');
  END IF;

  -- 3. Booking window / daily cap (skip if forced)
  IF NOT p_force THEN
    SELECT * INTO v_settings
      FROM benefit_settings
      WHERE branch_id = v_slot.branch_id
        AND benefit_type = v_slot.benefit_type
      LIMIT 1;

    v_window_hours := COALESCE(v_settings.booking_opens_hours_before, 168);
    v_slot_dt := (v_slot.slot_date::timestamp + v_slot.start_time) AT TIME ZONE 'Asia/Kolkata';

    IF v_slot_dt < now() THEN
      RETURN jsonb_build_object('success', false, 'error', 'Slot has already started');
    END IF;

    IF v_slot_dt > now() + (v_window_hours || ' hours')::interval THEN
      RETURN jsonb_build_object('success', false, 'error',
        format('Booking opens %s hours before the slot', v_window_hours));
    END IF;

    IF COALESCE(v_settings.max_bookings_per_day, 0) > 0 THEN
      SELECT count(*) INTO v_today_count
        FROM benefit_bookings bb
        JOIN benefit_slots bs ON bs.id = bb.slot_id
        WHERE bb.member_id = p_member_id
          AND bs.benefit_type = v_slot.benefit_type
          AND bs.slot_date = v_slot.slot_date
          AND bb.status IN ('booked','attended');
      IF v_today_count >= v_settings.max_bookings_per_day THEN
        RETURN jsonb_build_object('success', false, 'error', 'Daily booking limit reached');
      END IF;
    END IF;

    -- 4. Gender check
    SELECT * INTO v_facility FROM facilities WHERE id = v_slot.facility_id LIMIT 1;
    IF FOUND AND v_facility.gender_access IS NOT NULL AND v_facility.gender_access <> 'unisex' THEN
      SELECT lower(gender) INTO v_member_gender FROM members WHERE id = p_member_id;
      IF v_member_gender IS NOT NULL AND v_member_gender <> lower(v_facility.gender_access) THEN
        RETURN jsonb_build_object('success', false, 'error',
          format('This facility is %s-only', v_facility.gender_access));
      END IF;
    END IF;
  END IF;

  -- 5. Insert booking
  INSERT INTO benefit_bookings (
    slot_id, member_id, membership_id, status,
    booked_by_staff_id, source, force_added, force_reason
  ) VALUES (
    p_slot_id, p_member_id, p_membership_id, 'booked',
    p_staff_id, p_source, p_force, p_force_reason
  ) RETURNING id INTO v_booking_id;

  -- 6. Update slot count
  UPDATE benefit_slots SET booked_count = booked_count + 1 WHERE id = p_slot_id;

  -- 7. Notify
  BEGIN
    PERFORM public._notify_booking_event(v_booking_id, 'facility_slot_booked');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'booking_id', v_booking_id, 'force_added', p_force);
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_facility_slot(uuid,uuid,uuid,uuid,text,boolean,text) TO authenticated;

-- ============================================================
-- 5. Hardened cancel_facility_slot RPC
-- ============================================================
DROP FUNCTION IF EXISTS public.cancel_facility_slot(uuid, text);
DROP FUNCTION IF EXISTS public.cancel_facility_slot(uuid, text, uuid, boolean);

CREATE OR REPLACE FUNCTION public.cancel_facility_slot(
  p_booking_id uuid,
  p_reason text DEFAULT NULL,
  p_staff_id uuid DEFAULT NULL,
  p_override_deadline boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_slot RECORD;
  v_settings RECORD;
  v_slot_dt timestamptz;
  v_deadline_minutes integer;
  v_is_privileged boolean := false;
BEGIN
  SELECT * INTO v_booking FROM benefit_bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already cancelled');
  END IF;

  IF p_override_deadline THEN
    IF p_staff_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Override requires staff identity');
    END IF;
    SELECT (public.has_role(p_staff_id,'admin') OR public.has_role(p_staff_id,'owner') OR public.has_role(p_staff_id,'manager'))
      INTO v_is_privileged;
    IF NOT v_is_privileged THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only admin/owner/manager can override cancellation deadline');
    END IF;
  END IF;

  SELECT * INTO v_slot FROM benefit_slots WHERE id = v_booking.slot_id;

  IF NOT p_override_deadline THEN
    SELECT * INTO v_settings FROM benefit_settings
      WHERE branch_id = v_slot.branch_id AND benefit_type = v_slot.benefit_type LIMIT 1;
    v_deadline_minutes := COALESCE(v_settings.cancellation_deadline_minutes, 60);
    v_slot_dt := (v_slot.slot_date::timestamp + v_slot.start_time) AT TIME ZONE 'Asia/Kolkata';
    IF now() > v_slot_dt - (v_deadline_minutes || ' minutes')::interval THEN
      RETURN jsonb_build_object('success', false, 'error',
        format('Cancellation deadline is %s minutes before slot', v_deadline_minutes));
    END IF;
  END IF;

  UPDATE benefit_bookings SET
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = p_reason,
    cancelled_by_staff_id = p_staff_id
  WHERE id = p_booking_id;

  UPDATE benefit_slots SET booked_count = GREATEST(booked_count - 1, 0)
    WHERE id = v_booking.slot_id;

  BEGIN
    PERFORM public._notify_booking_event(p_booking_id, 'facility_slot_cancelled');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'overridden', p_override_deadline);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_facility_slot(uuid,text,uuid,boolean) TO authenticated;

-- ============================================================
-- 6. Templates: validation columns
-- ============================================================
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS last_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS validation_errors jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS trigger_event text;

CREATE INDEX IF NOT EXISTS idx_templates_trigger_event ON public.templates(trigger_event);
