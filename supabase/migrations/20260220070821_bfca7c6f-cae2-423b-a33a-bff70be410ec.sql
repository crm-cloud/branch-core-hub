
-- ============================================================
-- PRIORITY 1: book_facility_slot RPC with full enforcement
-- ============================================================

CREATE OR REPLACE FUNCTION public.book_facility_slot(
  p_slot_id UUID,
  p_member_id UUID,
  p_membership_id UUID
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_slot RECORD;
  v_plan_benefit RECORD;
  v_existing_count INTEGER;
  v_booking_id UUID;
BEGIN
  -- 1. Lock slot row to prevent race conditions
  SELECT * INTO v_slot FROM benefit_slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot not found');
  END IF;

  -- 2. Check capacity
  IF (v_slot.booked_count >= v_slot.capacity) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This slot is fully booked');
  END IF;

  -- 3. Duplicate booking guard (same slot, same member, active status)
  IF EXISTS (
    SELECT 1 FROM benefit_bookings 
    WHERE slot_id = p_slot_id 
      AND member_id = p_member_id 
      AND status IN ('booked', 'confirmed')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a booking for this slot');
  END IF;

  -- 4. Benefit limit enforcement (only if slot is linked to a benefit type)
  IF v_slot.benefit_type_id IS NOT NULL THEN
    SELECT pb.* INTO v_plan_benefit
    FROM plan_benefits pb
    JOIN memberships m ON m.plan_id = pb.plan_id
    WHERE m.id = p_membership_id 
      AND pb.benefit_type_id = v_slot.benefit_type_id
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
          WHEN 'monthly'        THEN bs.slot_date >= date_trunc('month', CURRENT_DATE)
          WHEN 'weekly'         THEN bs.slot_date >= date_trunc('week',  CURRENT_DATE)
          WHEN 'daily'          THEN bs.slot_date  = CURRENT_DATE
          ELSE TRUE
        END;

      IF v_existing_count >= v_plan_benefit.limit_count THEN
        RETURN jsonb_build_object(
          'success', false, 
          'error', 'Benefit limit reached (' || v_existing_count || '/' || v_plan_benefit.limit_count || '). Please purchase an add-on.'
        );
      END IF;
    END IF;
  END IF;

  -- 5. Insert booking
  INSERT INTO benefit_bookings (slot_id, member_id, membership_id, status)
  VALUES (p_slot_id, p_member_id, p_membership_id, 'booked')
  RETURNING id INTO v_booking_id;

  -- 6. Write to benefit_usage for entitlement tracking
  IF v_slot.benefit_type_id IS NOT NULL THEN
    INSERT INTO benefit_usage (
      membership_id, benefit_type, benefit_type_id, usage_date, usage_count
    ) VALUES (
      p_membership_id,
      v_slot.benefit_type,
      v_slot.benefit_type_id,
      CURRENT_DATE,
      1
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'booking_id', v_booking_id);
END;
$$;

-- ============================================================
-- PRIORITY 1b: cancel_facility_slot RPC (refunds usage)
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_facility_slot(
  p_booking_id UUID,
  p_reason TEXT DEFAULT 'Cancelled by member'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_booking RECORD;
  v_slot_benefit_type_id UUID;
BEGIN
  UPDATE benefit_bookings
  SET status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = p_reason
  WHERE id = p_booking_id 
    AND status IN ('booked', 'confirmed')
  RETURNING * INTO v_booking;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found or already cancelled');
  END IF;

  -- Get the benefit_type_id from the slot
  SELECT benefit_type_id INTO v_slot_benefit_type_id
  FROM benefit_slots WHERE id = v_booking.slot_id;

  -- Refund: delete the most recent matching usage record
  IF v_slot_benefit_type_id IS NOT NULL THEN
    DELETE FROM benefit_usage
    WHERE id = (
      SELECT id FROM benefit_usage
      WHERE membership_id = v_booking.membership_id
        AND benefit_type_id = v_slot_benefit_type_id
        AND usage_count = 1
      ORDER BY created_at DESC
      LIMIT 1
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- PRIORITY 1c: Unique partial index — DB-level duplicate guard
-- (duplicates already cleaned up by the data fix above)
-- ============================================================
DROP INDEX IF EXISTS benefit_bookings_no_dup;
CREATE UNIQUE INDEX benefit_bookings_no_dup
ON benefit_bookings(slot_id, member_id)
WHERE status IN ('booked', 'confirmed');
