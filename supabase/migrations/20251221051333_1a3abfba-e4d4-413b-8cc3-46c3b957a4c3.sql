-- Create workout templates table for reusable workout plans
CREATE TABLE IF NOT EXISTS public.workout_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES branches(id),
  trainer_id UUID REFERENCES trainers(id),
  name TEXT NOT NULL,
  description TEXT,
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  duration_weeks INTEGER DEFAULT 4,
  goal TEXT,
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create diet templates table
CREATE TABLE IF NOT EXISTS public.diet_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES branches(id),
  trainer_id UUID REFERENCES trainers(id),
  name TEXT NOT NULL,
  description TEXT,
  diet_type TEXT,
  calories_target INTEGER,
  meal_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trainer commissions table
CREATE TABLE IF NOT EXISTS public.trainer_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID NOT NULL REFERENCES trainers(id),
  pt_package_id UUID REFERENCES member_pt_packages(id),
  session_id UUID REFERENCES pt_sessions(id),
  commission_type TEXT NOT NULL CHECK (commission_type IN ('package_sale', 'session_completed')),
  amount NUMERIC NOT NULL,
  percentage NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trainer availability table for scheduling
CREATE TABLE IF NOT EXISTS public.trainer_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID NOT NULL REFERENCES trainers(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(trainer_id, day_of_week)
);

-- Enable RLS
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_availability ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workout_templates
CREATE POLICY "staff_view_workout_templates" ON workout_templates FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[]));

CREATE POLICY "trainer_manage_own_templates" ON workout_templates FOR ALL
  USING (
    trainer_id IN (SELECT id FROM trainers WHERE user_id = auth.uid()) OR
    has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[])
  );

-- RLS Policies for diet_templates
CREATE POLICY "staff_view_diet_templates" ON diet_templates FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[]));

CREATE POLICY "trainer_manage_own_diet_templates" ON diet_templates FOR ALL
  USING (
    trainer_id IN (SELECT id FROM trainers WHERE user_id = auth.uid()) OR
    has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[])
  );

-- RLS Policies for trainer_commissions
CREATE POLICY "trainer_view_own_commissions" ON trainer_commissions FOR SELECT
  USING (
    trainer_id IN (SELECT id FROM trainers WHERE user_id = auth.uid()) OR
    has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[])
  );

CREATE POLICY "admin_manage_commissions" ON trainer_commissions FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));

-- RLS Policies for trainer_availability
CREATE POLICY "view_trainer_availability" ON trainer_availability FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[]));

CREATE POLICY "trainer_manage_own_availability" ON trainer_availability FOR ALL
  USING (
    trainer_id IN (SELECT id FROM trainers WHERE user_id = auth.uid()) OR
    has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[])
  );

-- Function to purchase PT package
CREATE OR REPLACE FUNCTION public.purchase_pt_package(
  _member_id UUID,
  _package_id UUID,
  _trainer_id UUID,
  _branch_id UUID,
  _price_paid NUMERIC
) RETURNS JSONB AS $$
DECLARE
  _package RECORD;
  _member_package_id UUID;
  _commission_amount NUMERIC;
BEGIN
  -- Get package details
  SELECT * INTO _package FROM pt_packages WHERE id = _package_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Package not found or inactive');
  END IF;
  
  -- Create member PT package
  INSERT INTO member_pt_packages (
    member_id, package_id, trainer_id, branch_id,
    sessions_total, sessions_remaining, price_paid,
    start_date, expiry_date, status
  ) VALUES (
    _member_id, _package_id, _trainer_id, _branch_id,
    _package.total_sessions, _package.total_sessions, _price_paid,
    CURRENT_DATE, CURRENT_DATE + _package.validity_days, 'active'
  ) RETURNING id INTO _member_package_id;
  
  -- Calculate and record trainer commission (default 20%)
  _commission_amount := _price_paid * 0.20;
  INSERT INTO trainer_commissions (
    trainer_id, pt_package_id, commission_type, amount, percentage
  ) VALUES (
    _trainer_id, _member_package_id, 'package_sale', _commission_amount, 20
  );
  
  RETURN jsonb_build_object('success', true, 'member_package_id', _member_package_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to record PT session and commission
CREATE OR REPLACE FUNCTION public.complete_pt_session(
  _session_id UUID,
  _notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  _session RECORD;
  _package RECORD;
  _per_session_rate NUMERIC;
  _commission_amount NUMERIC;
BEGIN
  -- Get session
  SELECT * INTO _session FROM pt_sessions WHERE id = _session_id AND status = 'scheduled';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found or not scheduled');
  END IF;
  
  -- Update session status
  UPDATE pt_sessions SET status = 'completed', notes = COALESCE(_notes, notes) WHERE id = _session_id;
  
  -- Update member package sessions
  UPDATE member_pt_packages 
  SET sessions_used = sessions_used + 1,
      sessions_remaining = sessions_remaining - 1,
      status = CASE WHEN sessions_remaining <= 1 THEN 'completed' ELSE status END
  WHERE id = _session.member_pt_package_id
  RETURNING * INTO _package;
  
  -- Calculate per-session commission (10% of per-session value)
  _per_session_rate := _package.price_paid / _package.sessions_total;
  _commission_amount := _per_session_rate * 0.10;
  
  INSERT INTO trainer_commissions (
    trainer_id, session_id, commission_type, amount, percentage
  ) VALUES (
    _session.trainer_id, _session_id, 'session_completed', _commission_amount, 10
  );
  
  RETURN jsonb_build_object('success', true, 'sessions_remaining', _package.sessions_remaining - 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check trainer availability for a time slot
CREATE OR REPLACE FUNCTION public.check_trainer_slot_available(
  _trainer_id UUID,
  _scheduled_at TIMESTAMP WITH TIME ZONE,
  _duration_minutes INTEGER DEFAULT 60
) RETURNS BOOLEAN AS $$
DECLARE
  _day_of_week INTEGER;
  _time_slot TIME;
  _avail RECORD;
  _existing INT;
BEGIN
  _day_of_week := EXTRACT(DOW FROM _scheduled_at);
  _time_slot := _scheduled_at::TIME;
  
  -- Check if trainer has availability set for this day
  SELECT * INTO _avail FROM trainer_availability 
  WHERE trainer_id = _trainer_id AND day_of_week = _day_of_week AND is_active = true;
  
  IF FOUND THEN
    IF _time_slot < _avail.start_time OR _time_slot >= _avail.end_time THEN
      RETURN false;
    END IF;
  END IF;
  
  -- Check for existing sessions at this time
  SELECT COUNT(*) INTO _existing FROM pt_sessions
  WHERE trainer_id = _trainer_id
    AND status IN ('scheduled', 'completed')
    AND scheduled_at < _scheduled_at + (_duration_minutes || ' minutes')::INTERVAL
    AND scheduled_at + (COALESCE(duration_minutes, 60) || ' minutes')::INTERVAL > _scheduled_at;
  
  RETURN _existing = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;