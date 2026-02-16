
-- Add facility scheduling columns
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS available_days TEXT[] DEFAULT ARRAY['mon','tue','wed','thu','fri','sat','sun'];
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS under_maintenance BOOLEAN DEFAULT false;

-- Update validate_class_booking to support custom benefit types
CREATE OR REPLACE FUNCTION public.validate_class_booking(_class_id uuid, _member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _class RECORD;
  _current_bookings INT;
  _existing_booking RECORD;
  _membership RECORD;
  _benefit RECORD;
  _usage_count INT;
BEGIN
  SELECT * INTO _class FROM classes WHERE id = _class_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Class not found or inactive');
  END IF;
  
  IF _class.scheduled_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cannot book past classes');
  END IF;
  
  SELECT * INTO _existing_booking FROM class_bookings 
  WHERE class_id = _class_id AND member_id = _member_id AND status = 'booked';
  IF FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Already booked for this class');
  END IF;
  
  SELECT m.* INTO _membership FROM memberships m
  WHERE m.member_id = _member_id 
    AND m.status = 'active'
    AND m.start_date <= CURRENT_DATE 
    AND m.end_date >= CURRENT_DATE
  ORDER BY m.end_date DESC LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'No active membership');
  END IF;
  
  -- Check class benefit in plan (support both legacy enum and custom benefit types)
  SELECT pb.* INTO _benefit FROM plan_benefits pb
  LEFT JOIN benefit_types bt ON pb.benefit_type_id = bt.id
  WHERE pb.plan_id = _membership.plan_id 
    AND (
      pb.benefit_type = 'group_classes'
      OR bt.code IN ('class', 'group_classes')
    )
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Plan does not include group classes');
  END IF;
  
  -- Check benefit usage limit if applicable
  IF _benefit.limit_count IS NOT NULL THEN
    SELECT COALESCE(SUM(bu.usage_count), 0) INTO _usage_count
    FROM benefit_usage bu
    LEFT JOIN benefit_types bt ON bu.benefit_type_id = bt.id
    WHERE bu.membership_id = _membership.id 
      AND (
        bu.benefit_type = 'group_classes'
        OR bt.code IN ('class', 'group_classes')
      )
      AND (
        (_benefit.frequency = 'daily' AND bu.usage_date = CURRENT_DATE) OR
        (_benefit.frequency = 'weekly' AND bu.usage_date >= date_trunc('week', CURRENT_DATE)) OR
        (_benefit.frequency = 'monthly' AND bu.usage_date >= date_trunc('month', CURRENT_DATE)) OR
        (_benefit.frequency = 'per_membership')
      );
    
    IF _usage_count >= _benefit.limit_count THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Class booking limit reached for this period');
    END IF;
  END IF;
  
  SELECT COUNT(*) INTO _current_bookings FROM class_bookings 
  WHERE class_id = _class_id AND status = 'booked';
  
  IF _current_bookings >= _class.capacity THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Class is full', 'waitlist_available', true);
  END IF;
  
  RETURN jsonb_build_object('valid', true, 'membership_id', _membership.id);
END;
$function$;
