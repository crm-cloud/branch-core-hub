-- Function to validate class booking (checks capacity, benefits, duplicate booking)
CREATE OR REPLACE FUNCTION public.validate_class_booking(
  _class_id UUID,
  _member_id UUID
) RETURNS JSONB AS $$
DECLARE
  _class RECORD;
  _current_bookings INT;
  _existing_booking RECORD;
  _membership RECORD;
  _benefit RECORD;
  _usage_count INT;
BEGIN
  -- Get class details
  SELECT * INTO _class FROM classes WHERE id = _class_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Class not found or inactive');
  END IF;
  
  -- Check if class is in the past
  IF _class.scheduled_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cannot book past classes');
  END IF;
  
  -- Check for existing booking
  SELECT * INTO _existing_booking FROM class_bookings 
  WHERE class_id = _class_id AND member_id = _member_id AND status = 'booked';
  IF FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Already booked for this class');
  END IF;
  
  -- Check active membership
  SELECT m.* INTO _membership FROM memberships m
  WHERE m.member_id = _member_id 
    AND m.status = 'active'
    AND m.start_date <= CURRENT_DATE 
    AND m.end_date >= CURRENT_DATE
  ORDER BY m.end_date DESC LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'No active membership');
  END IF;
  
  -- Check class benefit in plan
  SELECT pb.* INTO _benefit FROM plan_benefits pb
  WHERE pb.plan_id = _membership.plan_id 
    AND pb.benefit_type = 'group_classes';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Plan does not include group classes');
  END IF;
  
  -- Check benefit usage limit if applicable
  IF _benefit.limit_count IS NOT NULL THEN
    SELECT COALESCE(SUM(usage_count), 0) INTO _usage_count
    FROM benefit_usage
    WHERE membership_id = _membership.id 
      AND benefit_type = 'group_classes'
      AND (
        (_benefit.frequency = 'daily' AND usage_date = CURRENT_DATE) OR
        (_benefit.frequency = 'weekly' AND usage_date >= date_trunc('week', CURRENT_DATE)) OR
        (_benefit.frequency = 'monthly' AND usage_date >= date_trunc('month', CURRENT_DATE)) OR
        (_benefit.frequency = 'per_membership')
      );
    
    IF _usage_count >= _benefit.limit_count THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Class booking limit reached for this period');
    END IF;
  END IF;
  
  -- Check capacity
  SELECT COUNT(*) INTO _current_bookings FROM class_bookings 
  WHERE class_id = _class_id AND status = 'booked';
  
  IF _current_bookings >= _class.capacity THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Class is full', 'waitlist_available', true);
  END IF;
  
  RETURN jsonb_build_object('valid', true, 'membership_id', _membership.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to book a class
CREATE OR REPLACE FUNCTION public.book_class(
  _class_id UUID,
  _member_id UUID
) RETURNS JSONB AS $$
DECLARE
  _validation JSONB;
  _booking_id UUID;
BEGIN
  -- Validate booking
  _validation := validate_class_booking(_class_id, _member_id);
  
  IF NOT (_validation->>'valid')::boolean THEN
    RETURN _validation;
  END IF;
  
  -- Create booking
  INSERT INTO class_bookings (class_id, member_id, status)
  VALUES (_class_id, _member_id, 'booked')
  RETURNING id INTO _booking_id;
  
  RETURN jsonb_build_object('success', true, 'booking_id', _booking_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to add to waitlist
CREATE OR REPLACE FUNCTION public.add_to_waitlist(
  _class_id UUID,
  _member_id UUID
) RETURNS JSONB AS $$
DECLARE
  _next_position INT;
  _waitlist_id UUID;
  _existing RECORD;
BEGIN
  -- Check if already on waitlist
  SELECT * INTO _existing FROM class_waitlist 
  WHERE class_id = _class_id AND member_id = _member_id;
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already on waitlist');
  END IF;
  
  -- Get next position
  SELECT COALESCE(MAX(position), 0) + 1 INTO _next_position
  FROM class_waitlist WHERE class_id = _class_id;
  
  -- Add to waitlist
  INSERT INTO class_waitlist (class_id, member_id, position)
  VALUES (_class_id, _member_id, _next_position)
  RETURNING id INTO _waitlist_id;
  
  RETURN jsonb_build_object('success', true, 'waitlist_id', _waitlist_id, 'position', _next_position);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to cancel booking
CREATE OR REPLACE FUNCTION public.cancel_class_booking(
  _booking_id UUID,
  _reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  _booking RECORD;
  _next_waitlist RECORD;
BEGIN
  -- Get and update booking
  UPDATE class_bookings 
  SET status = 'cancelled', cancelled_at = now(), cancellation_reason = _reason
  WHERE id = _booking_id AND status = 'booked'
  RETURNING * INTO _booking;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found or already cancelled');
  END IF;
  
  -- Promote from waitlist if exists
  SELECT * INTO _next_waitlist FROM class_waitlist 
  WHERE class_id = _booking.class_id 
  ORDER BY position LIMIT 1;
  
  IF FOUND THEN
    -- Create booking for waitlisted member
    INSERT INTO class_bookings (class_id, member_id, status)
    VALUES (_booking.class_id, _next_waitlist.member_id, 'booked');
    
    -- Update waitlist notification
    UPDATE class_waitlist SET notified_at = now() 
    WHERE id = _next_waitlist.id;
    
    -- Remove from waitlist
    DELETE FROM class_waitlist WHERE id = _next_waitlist.id;
    
    -- Reorder positions
    UPDATE class_waitlist SET position = position - 1 
    WHERE class_id = _booking.class_id AND position > _next_waitlist.position;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'promoted_from_waitlist', FOUND);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to mark attendance (attended/no_show)
CREATE OR REPLACE FUNCTION public.mark_class_attendance(
  _booking_id UUID,
  _attended BOOLEAN
) RETURNS JSONB AS $$
DECLARE
  _booking RECORD;
  _membership RECORD;
BEGIN
  -- Update booking status
  UPDATE class_bookings 
  SET status = CASE WHEN _attended THEN 'attended' ELSE 'no_show' END,
      attended_at = CASE WHEN _attended THEN now() ELSE NULL END
  WHERE id = _booking_id AND status = 'booked'
  RETURNING * INTO _booking;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found or not in booked status');
  END IF;
  
  -- Record benefit usage if attended
  IF _attended THEN
    SELECT m.* INTO _membership FROM memberships m
    WHERE m.member_id = _booking.member_id 
      AND m.status = 'active'
    ORDER BY m.end_date DESC LIMIT 1;
    
    IF FOUND THEN
      INSERT INTO benefit_usage (membership_id, benefit_type, usage_date, usage_count)
      VALUES (_membership.id, 'group_classes', CURRENT_DATE, 1);
    END IF;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'status', CASE WHEN _attended THEN 'attended' ELSE 'no_show' END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add RLS policy for trainers if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trainers' AND policyname = 'staff_access_trainers') THEN
    ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "staff_access_trainers" ON trainers FOR ALL
      USING (has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[]));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trainers' AND policyname = 'view_active_trainers') THEN
    CREATE POLICY "view_active_trainers" ON trainers FOR SELECT
      USING (is_active = true);
  END IF;
END $$;