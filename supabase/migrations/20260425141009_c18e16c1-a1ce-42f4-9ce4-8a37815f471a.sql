-- ============================================================
-- Fitness plan adherence tracking tables
-- ============================================================

-- 1) Workout completions
CREATE TABLE IF NOT EXISTS public.member_workout_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  plan_source text NOT NULL CHECK (plan_source IN ('member_fitness_plans','workout_plans')),
  plan_id uuid NOT NULL,
  week_number integer NOT NULL DEFAULT 1,
  day_label text NOT NULL,
  exercise_index integer NOT NULL,
  exercise_name text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mwc_unique_exercise UNIQUE (member_id, plan_source, plan_id, week_number, day_label, exercise_index)
);

CREATE INDEX IF NOT EXISTS idx_mwc_member_plan ON public.member_workout_completions (member_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_mwc_member_date ON public.member_workout_completions (member_id, completed_at DESC);

ALTER TABLE public.member_workout_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own workout completions"
  ON public.member_workout_completions FOR SELECT
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Members can insert own workout completions"
  ON public.member_workout_completions FOR INSERT
  WITH CHECK (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Members can delete own workout completions"
  ON public.member_workout_completions FOR DELETE
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Staff view all workout completions"
  ON public.member_workout_completions FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role,'staff'::app_role,'trainer'::app_role]));

-- 2) Meal completions
CREATE TABLE IF NOT EXISTS public.member_meal_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  plan_source text NOT NULL CHECK (plan_source IN ('member_fitness_plans','diet_plans')),
  plan_id uuid NOT NULL,
  meal_date date NOT NULL,
  meal_index integer NOT NULL,
  meal_name text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mmc_unique_meal UNIQUE (member_id, plan_source, plan_id, meal_date, meal_index)
);

CREATE INDEX IF NOT EXISTS idx_mmc_member_plan ON public.member_meal_completions (member_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_mmc_member_date ON public.member_meal_completions (member_id, completed_at DESC);

ALTER TABLE public.member_meal_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own meal completions"
  ON public.member_meal_completions FOR SELECT
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Members can insert own meal completions"
  ON public.member_meal_completions FOR INSERT
  WITH CHECK (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Members can delete own meal completions"
  ON public.member_meal_completions FOR DELETE
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Staff view all meal completions"
  ON public.member_meal_completions FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role,'staff'::app_role,'trainer'::app_role]));

-- 3) Meal swaps
CREATE TABLE IF NOT EXISTS public.member_meal_swaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  plan_source text NOT NULL CHECK (plan_source IN ('member_fitness_plans','diet_plans')),
  plan_id uuid NOT NULL,
  meal_index integer NOT NULL,
  original_meal jsonb,
  new_meal jsonb NOT NULL,
  catalog_meal_id uuid REFERENCES public.meal_catalog(id) ON DELETE SET NULL,
  swapped_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mms_member_plan ON public.member_meal_swaps (member_id, plan_id);

ALTER TABLE public.member_meal_swaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own meal swaps"
  ON public.member_meal_swaps FOR SELECT
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Members can insert own meal swaps"
  ON public.member_meal_swaps FOR INSERT
  WITH CHECK (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Members can delete own meal swaps"
  ON public.member_meal_swaps FOR DELETE
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Staff view all meal swaps"
  ON public.member_meal_swaps FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role,'staff'::app_role,'trainer'::app_role]));