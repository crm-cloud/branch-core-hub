-- 1. Check if expense_categories already has data, if not insert
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'Utilities') THEN
    INSERT INTO expense_categories (name, description, is_active) VALUES
      ('Utilities', 'Electricity, Water, Internet', true),
      ('Salaries', 'Staff and trainer salaries', true),
      ('Maintenance', 'Equipment and building maintenance', true),
      ('Marketing', 'Advertising and promotions', true),
      ('Inventory Purchase', 'Product restocking', true),
      ('Rent', 'Building lease payments', true),
      ('Insurance', 'Business insurance', true),
      ('Miscellaneous', 'Other expenses', true);
  END IF;
END $$;

-- 2. Create exercises table for workout randomization
CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  target_muscle TEXT NOT NULL,
  equipment_type TEXT,
  difficulty TEXT DEFAULT 'intermediate',
  instructions TEXT,
  video_url TEXT,
  image_url TEXT,
  calories_per_minute NUMERIC,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Exercises are readable by authenticated users" ON exercises;
DROP POLICY IF EXISTS "Admins can manage exercises" ON exercises;

-- Exercises are readable by all authenticated users
CREATE POLICY "Exercises are readable by authenticated users" ON exercises
  FOR SELECT TO authenticated USING (true);

-- Only admin/owner can manage exercises
CREATE POLICY "Admins can manage exercises" ON exercises
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]));

-- 3. Seed common gym exercises (check if table is empty first)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM exercises LIMIT 1) THEN
    INSERT INTO exercises (name, target_muscle, equipment_type, difficulty, instructions) VALUES
      -- Chest
      ('Barbell Bench Press', 'chest', 'barbell', 'intermediate', 'Lie on bench, grip bar shoulder-width, lower to chest, press up'),
      ('Incline Dumbbell Press', 'chest', 'dumbbell', 'intermediate', 'Set bench to 30-45 degrees, press dumbbells from shoulders'),
      ('Decline Bench Press', 'chest', 'barbell', 'intermediate', 'Lie on decline bench, press bar from chest'),
      ('Cable Flyes', 'chest', 'cable', 'beginner', 'Stand between cables, bring handles together in arc motion'),
      ('Push-ups', 'chest', 'bodyweight', 'beginner', 'Hands shoulder-width, lower body until chest near floor, push up'),
      ('Dumbbell Flyes', 'chest', 'dumbbell', 'beginner', 'Lie on bench, arc dumbbells from sides to above chest'),
      ('Machine Chest Press', 'chest', 'machine', 'beginner', 'Sit in machine, press handles forward'),
      ('Pec Deck Machine', 'chest', 'machine', 'beginner', 'Sit and bring pads together in front of chest'),
      -- Back
      ('Lat Pulldown', 'back', 'cable', 'beginner', 'Pull bar down to upper chest, squeeze shoulder blades'),
      ('Barbell Rows', 'back', 'barbell', 'intermediate', 'Bend over, pull bar to lower chest'),
      ('Seated Cable Row', 'back', 'cable', 'beginner', 'Sit at cable station, pull handle to stomach'),
      ('Pull-ups', 'back', 'bodyweight', 'advanced', 'Hang from bar, pull body up until chin over bar'),
      ('Dumbbell Rows', 'back', 'dumbbell', 'beginner', 'One arm at a time, pull dumbbell to hip'),
      ('T-Bar Row', 'back', 'barbell', 'intermediate', 'Straddle bar, row to chest'),
      ('Deadlifts', 'back', 'barbell', 'advanced', 'Stand with bar on floor, lift with straight back'),
      ('Face Pulls', 'back', 'cable', 'beginner', 'Pull rope to face level, squeeze rear delts'),
      -- Legs
      ('Barbell Squats', 'legs', 'barbell', 'intermediate', 'Bar on upper back, squat until thighs parallel to floor'),
      ('Leg Press', 'legs', 'machine', 'beginner', 'Push platform away with feet shoulder-width'),
      ('Leg Extensions', 'legs', 'machine', 'beginner', 'Extend legs to straighten knees'),
      ('Leg Curls', 'legs', 'machine', 'beginner', 'Curl legs to bring heels toward glutes'),
      ('Walking Lunges', 'legs', 'dumbbell', 'intermediate', 'Step forward into lunge, alternate legs'),
      ('Romanian Deadlifts', 'legs', 'barbell', 'intermediate', 'Hip hinge with slight knee bend, lower bar along legs'),
      ('Calf Raises', 'legs', 'machine', 'beginner', 'Rise up on toes, lower heels below platform'),
      ('Hack Squat', 'legs', 'machine', 'intermediate', 'Shoulders under pads, squat down and up'),
      -- Shoulders
      ('Overhead Press', 'shoulders', 'barbell', 'intermediate', 'Press bar from shoulders overhead'),
      ('Lateral Raises', 'shoulders', 'dumbbell', 'beginner', 'Raise arms to sides until parallel to floor'),
      ('Front Raises', 'shoulders', 'dumbbell', 'beginner', 'Raise dumbbells in front to shoulder height'),
      ('Rear Delt Flyes', 'shoulders', 'dumbbell', 'beginner', 'Bend over, raise arms to sides'),
      ('Arnold Press', 'shoulders', 'dumbbell', 'intermediate', 'Rotate palms while pressing overhead'),
      ('Machine Shoulder Press', 'shoulders', 'machine', 'beginner', 'Sit and press handles overhead'),
      ('Upright Rows', 'shoulders', 'barbell', 'intermediate', 'Pull bar up to chin, elbows high'),
      ('Shrugs', 'shoulders', 'dumbbell', 'beginner', 'Lift shoulders toward ears'),
      -- Arms
      ('Barbell Curls', 'arms', 'barbell', 'beginner', 'Curl bar from thighs to shoulders'),
      ('Dumbbell Curls', 'arms', 'dumbbell', 'beginner', 'Alternate curling dumbbells'),
      ('Hammer Curls', 'arms', 'dumbbell', 'beginner', 'Curl with neutral grip'),
      ('Preacher Curls', 'arms', 'barbell', 'intermediate', 'Curl on preacher bench'),
      ('Tricep Pushdowns', 'arms', 'cable', 'beginner', 'Push cable down, extend arms fully'),
      ('Skull Crushers', 'arms', 'barbell', 'intermediate', 'Lying, lower bar to forehead, extend'),
      ('Tricep Dips', 'arms', 'bodyweight', 'intermediate', 'Lower body between parallel bars'),
      ('Overhead Tricep Extension', 'arms', 'dumbbell', 'beginner', 'Extend dumbbell overhead'),
      -- Core
      ('Planks', 'core', 'bodyweight', 'beginner', 'Hold body in straight line on forearms and toes'),
      ('Crunches', 'core', 'bodyweight', 'beginner', 'Lie on back, curl shoulders toward hips'),
      ('Leg Raises', 'core', 'bodyweight', 'intermediate', 'Hang or lie, raise legs to 90 degrees'),
      ('Russian Twists', 'core', 'bodyweight', 'intermediate', 'Seated, twist torso side to side'),
      ('Cable Woodchops', 'core', 'cable', 'intermediate', 'Rotate torso pulling cable diagonally'),
      ('Mountain Climbers', 'core', 'bodyweight', 'beginner', 'In plank, alternate driving knees to chest'),
      -- Full Body & Cardio
      ('Burpees', 'full_body', 'bodyweight', 'intermediate', 'Squat, jump back, push-up, jump up'),
      ('Kettlebell Swings', 'full_body', 'dumbbell', 'intermediate', 'Swing kettlebell from between legs to shoulder height'),
      ('Treadmill Running', 'cardio', 'cardio', 'beginner', 'Run on treadmill at desired pace'),
      ('Stationary Bike', 'cardio', 'cardio', 'beginner', 'Cycle at steady or interval pace'),
      ('Rowing Machine', 'cardio', 'cardio', 'intermediate', 'Full body rowing motion'),
      ('Elliptical Trainer', 'cardio', 'cardio', 'beginner', 'Low-impact cardio movement');
  END IF;
END $$;

-- 4. Add human-readable columns to audit_logs (if not exist)
ALTER TABLE audit_logs 
  ADD COLUMN IF NOT EXISTS actor_name TEXT,
  ADD COLUMN IF NOT EXISTS action_description TEXT;

-- 5. Update the audit log trigger function to capture actor name and description
CREATE OR REPLACE FUNCTION public.audit_log_trigger_function()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  record_pk uuid;
  branch_val uuid;
  actor_name_val text;
  action_desc text;
  record_name text;
BEGIN
  -- Get the record ID as UUID
  IF TG_OP = 'DELETE' THEN
    record_pk := OLD.id;
  ELSE
    record_pk := NEW.id;
  END IF;
  
  -- Get branch_id if available
  IF TG_OP = 'DELETE' THEN
    BEGIN
      branch_val := OLD.branch_id;
    EXCEPTION WHEN undefined_column THEN
      branch_val := NULL;
    END;
  ELSE
    BEGIN
      branch_val := NEW.branch_id;
    EXCEPTION WHEN undefined_column THEN
      branch_val := NULL;
    END;
  END IF;

  -- Fetch actor name from profiles
  SELECT full_name INTO actor_name_val 
  FROM public.profiles 
  WHERE id = auth.uid();
  
  IF actor_name_val IS NULL THEN
    actor_name_val := 'System';
  END IF;

  -- Try to get a human-readable name from the record
  record_name := record_pk::text;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      IF to_jsonb(OLD) ? 'name' THEN record_name := OLD.name::text;
      ELSIF to_jsonb(OLD) ? 'full_name' THEN record_name := OLD.full_name::text;
      ELSIF to_jsonb(OLD) ? 'member_code' THEN record_name := OLD.member_code::text;
      ELSIF to_jsonb(OLD) ? 'invoice_number' THEN record_name := OLD.invoice_number::text;
      ELSIF to_jsonb(OLD) ? 'title' THEN record_name := OLD.title::text;
      END IF;
    ELSE
      IF to_jsonb(NEW) ? 'name' THEN record_name := NEW.name::text;
      ELSIF to_jsonb(NEW) ? 'full_name' THEN record_name := NEW.full_name::text;
      ELSIF to_jsonb(NEW) ? 'member_code' THEN record_name := NEW.member_code::text;
      ELSIF to_jsonb(NEW) ? 'invoice_number' THEN record_name := NEW.invoice_number::text;
      ELSIF to_jsonb(NEW) ? 'title' THEN record_name := NEW.title::text;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Keep the default record_pk
  END;

  -- Generate human-readable action description
  action_desc := actor_name_val || ' ' || 
    CASE TG_OP
      WHEN 'INSERT' THEN 'created'
      WHEN 'UPDATE' THEN 'updated'
      WHEN 'DELETE' THEN 'deleted'
      ELSE TG_OP
    END || ' ' || TG_TABLE_NAME || ' "' || COALESCE(SUBSTRING(record_name, 1, 50), 'record') || '"';

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      action, table_name, record_id, new_data, user_id, branch_id, actor_name, action_description
    ) VALUES (
      'INSERT', TG_TABLE_NAME, record_pk, 
      to_jsonb(NEW), 
      auth.uid(),
      branch_val,
      actor_name_val,
      action_desc
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (
      action, table_name, record_id, old_data, new_data, user_id, branch_id, actor_name, action_description
    ) VALUES (
      'UPDATE', TG_TABLE_NAME, record_pk, 
      to_jsonb(OLD), to_jsonb(NEW), 
      auth.uid(),
      branch_val,
      actor_name_val,
      action_desc
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (
      action, table_name, record_id, old_data, user_id, branch_id, actor_name, action_description
    ) VALUES (
      'DELETE', TG_TABLE_NAME, record_pk, 
      to_jsonb(OLD), 
      auth.uid(),
      branch_val,
      actor_name_val,
      action_desc
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;