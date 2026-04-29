
ALTER TABLE public.fitness_plan_templates
  ADD COLUMN IF NOT EXISTS is_common boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS system_template boolean NOT NULL DEFAULT false;

ALTER TABLE public.member_fitness_plans
  ADD COLUMN IF NOT EXISTS is_common boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_fitness_plan_templates_is_common
  ON public.fitness_plan_templates(is_common) WHERE is_common = true;

CREATE INDEX IF NOT EXISTS idx_fitness_plan_templates_system
  ON public.fitness_plan_templates(system_template) WHERE system_template = true;

-- Seed system templates (idempotent)
INSERT INTO public.fitness_plan_templates
  (name, type, description, difficulty, goal, content, is_active, system_template, is_common, branch_id)
SELECT v.name, v.type, v.description, v.difficulty, v.goal, v.content::jsonb, true, true, true, NULL::uuid
FROM (VALUES
  ('Beginner Full Body','workout','3-day full body program for absolute beginners','beginner','General Fitness',
   '{"name":"Beginner Full Body","type":"workout","weeks":[{"week":1,"days":[{"day":"Monday","focus":"Full Body A","exercises":[{"name":"Bodyweight Squats","sets":3,"reps":"12","rest":"60s"},{"name":"Push-ups","sets":3,"reps":"10","rest":"60s"},{"name":"Dumbbell Rows","sets":3,"reps":"10","rest":"60s"},{"name":"Plank Hold","sets":3,"reps":"30s","rest":"45s"}]},{"day":"Wednesday","focus":"Full Body B","exercises":[{"name":"Lunges","sets":3,"reps":"10/leg","rest":"60s"},{"name":"Dumbbell Press","sets":3,"reps":"10","rest":"60s"},{"name":"Lat Pulldown","sets":3,"reps":"12","rest":"60s"},{"name":"Russian Twists","sets":3,"reps":"20","rest":"45s"}]},{"day":"Friday","focus":"Full Body C","exercises":[{"name":"Goblet Squats","sets":3,"reps":"12","rest":"60s"},{"name":"Incline Push-ups","sets":3,"reps":"12","rest":"60s"},{"name":"Seated Cable Row","sets":3,"reps":"12","rest":"60s"},{"name":"Dead Bug","sets":3,"reps":"10/side","rest":"45s"}]}]}]}'),
  ('Weight Loss Circuit','workout','High-intensity circuit training for maximum calorie burn','intermediate','Weight Loss',
   '{"name":"Weight Loss Circuit","type":"workout","weeks":[{"week":1,"days":[{"day":"Monday","focus":"HIIT Circuit","exercises":[{"name":"Burpees","sets":4,"reps":"10","rest":"30s"},{"name":"Mountain Climbers","sets":4,"reps":"20","rest":"30s"},{"name":"Jump Squats","sets":4,"reps":"15","rest":"30s"},{"name":"Kettlebell Swings","sets":4,"reps":"15","rest":"30s"}]},{"day":"Wednesday","focus":"Cardio + Core","exercises":[{"name":"Treadmill Intervals","sets":1,"reps":"20 min","rest":"-"},{"name":"Bicycle Crunches","sets":3,"reps":"20","rest":"30s"},{"name":"Leg Raises","sets":3,"reps":"15","rest":"30s"}]},{"day":"Friday","focus":"Full Body Burn","exercises":[{"name":"Deadlifts","sets":4,"reps":"10","rest":"45s"},{"name":"Push Press","sets":4,"reps":"10","rest":"45s"},{"name":"Rowing Machine","sets":1,"reps":"500m","rest":"-"},{"name":"Plank Jacks","sets":3,"reps":"20","rest":"30s"}]}]}]}'),
  ('Muscle Building Split','workout','Push/Pull/Legs split for hypertrophy','intermediate','Muscle Gain',
   '{"name":"Muscle Building Split","type":"workout","weeks":[{"week":1,"days":[{"day":"Monday","focus":"Push","exercises":[{"name":"Bench Press","sets":4,"reps":"8-10","rest":"90s"},{"name":"Overhead Press","sets":3,"reps":"10","rest":"90s"},{"name":"Incline Dumbbell Press","sets":3,"reps":"12","rest":"60s"},{"name":"Lateral Raises","sets":3,"reps":"15","rest":"45s"},{"name":"Tricep Pushdowns","sets":3,"reps":"12","rest":"45s"}]},{"day":"Wednesday","focus":"Pull","exercises":[{"name":"Barbell Rows","sets":4,"reps":"8-10","rest":"90s"},{"name":"Pull-ups","sets":3,"reps":"8","rest":"90s"},{"name":"Face Pulls","sets":3,"reps":"15","rest":"45s"},{"name":"Barbell Curls","sets":3,"reps":"12","rest":"45s"}]},{"day":"Friday","focus":"Legs","exercises":[{"name":"Barbell Squats","sets":4,"reps":"8-10","rest":"120s"},{"name":"Romanian Deadlifts","sets":3,"reps":"10","rest":"90s"},{"name":"Leg Press","sets":3,"reps":"12","rest":"90s"},{"name":"Calf Raises","sets":4,"reps":"15","rest":"45s"}]}]}]}'),
  ('Balanced 1800 kcal','diet','Balanced macro split for general weight management','beginner','Maintenance',
   '{"name":"Balanced 1800 kcal","type":"diet","totals":{"calories":1800,"protein_g":135,"carbs_g":180,"fat_g":60},"days":[{"day":"Daily Plan","meals":[{"name":"Breakfast","time":"8:00 AM","items":["3 egg whites + 1 whole egg omelette","2 slices wholewheat toast","1 cup green tea"],"calories":380,"protein":28,"carbs":34,"fat":12},{"name":"Mid-Morning","time":"11:00 AM","items":["1 medium apple","10 almonds"],"calories":160,"protein":4,"carbs":22,"fat":8},{"name":"Lunch","time":"1:30 PM","items":["150g grilled chicken / paneer","1 cup brown rice","Mixed salad"],"calories":520,"protein":40,"carbs":55,"fat":14},{"name":"Snack","time":"5:00 PM","items":["1 scoop whey protein","1 banana"],"calories":280,"protein":28,"carbs":32,"fat":4},{"name":"Dinner","time":"8:30 PM","items":["150g fish / tofu","2 rotis","Sauteed veggies"],"calories":460,"protein":35,"carbs":40,"fat":16}]}]}'),
  ('High-Protein 2400 kcal','diet','For lean muscle gain - 200g+ protein','intermediate','Muscle Gain',
   '{"name":"High-Protein 2400 kcal","type":"diet","totals":{"calories":2400,"protein_g":210,"carbs_g":240,"fat_g":75},"days":[{"day":"Daily Plan","meals":[{"name":"Breakfast","time":"7:30 AM","items":["5 egg whites + 2 whole eggs","1 cup oats with milk","1 banana"],"calories":620,"protein":48,"carbs":68,"fat":18},{"name":"Mid-Morning","time":"11:00 AM","items":["1 scoop whey","1 tbsp peanut butter","1 apple"],"calories":340,"protein":30,"carbs":32,"fat":12},{"name":"Lunch","time":"2:00 PM","items":["200g grilled chicken","1.5 cups rice","Salad + curd"],"calories":720,"protein":58,"carbs":80,"fat":18},{"name":"Pre-Workout","time":"5:30 PM","items":["1 cup Greek yogurt","Handful berries"],"calories":220,"protein":22,"carbs":24,"fat":4},{"name":"Dinner","time":"9:00 PM","items":["200g fish / paneer","2 rotis","Veggies + dal"],"calories":500,"protein":52,"carbs":36,"fat":18}]}]}'),
  ('Vegetarian 1600 kcal','diet','Plant-based balanced diet for fat loss','beginner','Weight Loss',
   '{"name":"Vegetarian 1600 kcal","type":"diet","totals":{"calories":1600,"protein_g":105,"carbs_g":160,"fat_g":55},"days":[{"day":"Daily Plan","meals":[{"name":"Breakfast","time":"8:00 AM","items":["1 cup poha with sprouts","1 cup tea (no sugar)"],"calories":320,"protein":12,"carbs":48,"fat":8},{"name":"Mid-Morning","time":"11:00 AM","items":["1 scoop plant protein","1 orange"],"calories":180,"protein":24,"carbs":18,"fat":2},{"name":"Lunch","time":"1:30 PM","items":["100g paneer / tofu","1 cup quinoa","Salad + dal"],"calories":480,"protein":34,"carbs":48,"fat":16},{"name":"Snack","time":"5:00 PM","items":["1 cup buttermilk","Roasted chana 30g"],"calories":180,"protein":12,"carbs":22,"fat":4},{"name":"Dinner","time":"8:30 PM","items":["2 rotis","Mixed veg curry","1 bowl curd"],"calories":440,"protein":23,"carbs":54,"fat":14}]}]}')
) AS v(name, type, description, difficulty, goal, content)
WHERE NOT EXISTS (
  SELECT 1 FROM public.fitness_plan_templates t
  WHERE t.system_template = true AND t.name = v.name
);

-- AI Dashboard Insights cache
CREATE TABLE IF NOT EXISTS public.ai_dashboard_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  insights jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_dashboard_insights_lookup
  ON public.ai_dashboard_insights(user_id, branch_id, generated_at DESC);

ALTER TABLE public.ai_dashboard_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own insights" ON public.ai_dashboard_insights;
CREATE POLICY "Users can read their own insights" ON public.ai_dashboard_insights FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert their own insights" ON public.ai_dashboard_insights;
CREATE POLICY "Users can insert their own insights" ON public.ai_dashboard_insights FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update their own insights" ON public.ai_dashboard_insights;
CREATE POLICY "Users can update their own insights" ON public.ai_dashboard_insights FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can delete their own insights" ON public.ai_dashboard_insights;
CREATE POLICY "Users can delete their own insights" ON public.ai_dashboard_insights FOR DELETE USING (user_id = auth.uid());

-- Realtime for error_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'error_logs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.error_logs';
  END IF;
END $$;

ALTER TABLE public.error_logs REPLICA IDENTITY FULL;
