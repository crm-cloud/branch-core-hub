-- P4: Member-Facing Plan View — progress tracking + meal catalog enrichment
--
-- Builds on top of the P3 migration (20260418090000_p3_videos_meal_catalog.sql)
-- which already creates `meal_catalog`, the workout-videos storage bucket and
-- the initial seed.
--
-- This migration:
--   1. Extends `meal_catalog` with the optional fields the member-facing UI
--      needs (description, ingredients, prep_video_url, recipe_link) and
--      relaxes the dietary_type / meal_type CHECKs so future seeds can use
--      'eggetarian' and 'any'.
--   2. Adds completion tables (workout + meal) and meal-swap history.
--      `plan_id` is intentionally NOT a foreign key — assigned plans live in
--      three tables (`member_fitness_plans`, `workout_plans`, `diet_plans`)
--      and a `plan_source` column tells us which one. Composite (member, source,
--      plan) uniqueness guarantees correct upsert semantics.
--   3. Tops up the catalog with a few missing items used by the demo UI.

-- ============================================================
-- 1. meal_catalog enrichment
-- ============================================================
ALTER TABLE public.meal_catalog
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS ingredients TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS prep_video_url TEXT,
  ADD COLUMN IF NOT EXISTS recipe_link TEXT;

-- Relax CHECK constraints so the `eggetarian` dietary type and the `any`
-- meal_type filter (used as the "no preference" sentinel by the UI) become
-- valid values.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.meal_catalog'::regclass
      AND contype = 'c'
      AND conname IN ('meal_catalog_dietary_type_check', 'meal_catalog_meal_type_check')
  LOOP
    EXECUTE format('ALTER TABLE public.meal_catalog DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.meal_catalog
  ADD CONSTRAINT meal_catalog_dietary_type_check
  CHECK (dietary_type IN ('vegetarian','non_vegetarian','vegan','pescatarian','eggetarian'));

ALTER TABLE public.meal_catalog
  ADD CONSTRAINT meal_catalog_meal_type_check
  CHECK (meal_type IN ('breakfast','lunch','dinner','snack','pre_workout','post_workout','any'));

-- Backfill ingredient lists for the P3 seed so the shopping-list builder has
-- catalog-quality data to draw from. Updates are idempotent: only rows whose
-- ingredients array is still empty get populated.
UPDATE public.meal_catalog SET ingredients = ARRAY['poha','onion','potato','peas','mustard seeds','curry leaves']
  WHERE name = 'Vegetable Poha' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['oats','onion','tomato','green peas','turmeric','salt','olive oil']
  WHERE name = 'Masala Oats' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['moong dal','onion','green chilli','ginger','coriander']
  WHERE name = 'Moong Dal Chilla (2 pcs)' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['idli batter','toor dal','tamarind','sambar masala','vegetables']
  WHERE name = 'Idli with Sambar (3 pcs)' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['eggs','onion','tomato','wheat flour','green chilli','coriander']
  WHERE name = 'Egg Bhurji + 2 Roti' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['paneer','wheat flour','onion','coriander','ghee']
  WHERE name = 'Paneer Paratha (2 pcs)' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['greek yogurt','banana','mixed nuts','honey']
  WHERE name = 'Greek Yoghurt + Banana + Nuts' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['tofu','onion','tomato','turmeric','salt','olive oil']
  WHERE name = 'Vegan Tofu Scramble' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['toor dal','onion','tomato','wheat flour','ghee','spices']
  WHERE name = 'Dal Tadka + 2 Roti + Salad' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['rajma','onion','tomato','rice','spices']
  WHERE name = 'Rajma Chawal' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['chickpeas','onion','tomato','wheat flour','spices']
  WHERE name = 'Chole + 2 Roti' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['chicken breast','brown rice','olive oil','herbs','lemon']
  WHERE name = 'Grilled Chicken + Brown Rice' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['fish fillet','coconut milk','onion','tomato','rice','spices']
  WHERE name = 'Fish Curry + Rice' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['paneer','onion','tomato','wheat flour','spices','ghee']
  WHERE name = 'Paneer Bhurji + 2 Roti' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['quinoa','sweet potato','chickpeas','spinach','tahini','olive oil']
  WHERE name = 'Quinoa Buddha Bowl' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['mixed vegetables','onion','tomato','wheat flour','spices']
  WHERE name = 'Mixed Veg Sabzi + 2 Roti' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['rice','moong dal','vegetables','ghee','curd']
  WHERE name = 'Khichdi + Curd' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['chicken','yogurt','tandoori masala','onion','lemon','salad greens']
  WHERE name = 'Tandoori Chicken + Salad' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['paneer','spinach','onion','tomato','wheat flour','ghee']
  WHERE name = 'Palak Paneer + 2 Roti' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['salmon','broccoli','carrot','olive oil','lemon','herbs']
  WHERE name = 'Grilled Salmon + Veg' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['tofu','rice','bell peppers','broccoli','soy sauce','ginger','garlic','sesame oil']
  WHERE name = 'Tofu Stir Fry + Rice' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['chickpeas','salt','spices']
  WHERE name = 'Roasted Chana (1 fistful)' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['mixed sprouts','onion','tomato','lemon','salt']
  WHERE name = 'Sprouts Salad' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['banana','peanut butter']
  WHERE name = 'Banana + Peanut Butter' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['whey protein','water']
  WHERE name = 'Whey Protein Shake' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['eggs']
  WHERE name = 'Boiled Eggs (3 whole)' AND cardinality(ingredients) = 0;
UPDATE public.meal_catalog SET ingredients = ARRAY['curd','water','cumin','salt','mint']
  WHERE name = 'Masala Buttermilk' AND cardinality(ingredients) = 0;

-- ============================================================
-- 2. member_workout_completions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.member_workout_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  plan_source text NOT NULL DEFAULT 'member_fitness_plans',
  plan_id uuid NOT NULL,
  week_number int NOT NULL DEFAULT 1,
  day_label text NOT NULL,
  exercise_index int NOT NULL,
  exercise_name text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mwc_plan_source_check CHECK (plan_source IN ('member_fitness_plans','workout_plans')),
  CONSTRAINT mwc_unique UNIQUE (member_id, plan_source, plan_id, week_number, day_label, exercise_index)
);

CREATE INDEX IF NOT EXISTS mwc_member_plan_idx
  ON public.member_workout_completions(member_id, plan_source, plan_id);
CREATE INDEX IF NOT EXISTS mwc_completed_at_idx
  ON public.member_workout_completions(completed_at);

ALTER TABLE public.member_workout_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage own workout completions" ON public.member_workout_completions;
CREATE POLICY "Members manage own workout completions"
  ON public.member_workout_completions
  FOR ALL TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()))
  WITH CHECK (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Staff view workout completions" ON public.member_workout_completions;
CREATE POLICY "Staff view workout completions"
  ON public.member_workout_completions
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer']::app_role[]));

-- ============================================================
-- 3. member_meal_completions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.member_meal_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  plan_source text NOT NULL DEFAULT 'member_fitness_plans',
  plan_id uuid NOT NULL,
  meal_date date NOT NULL DEFAULT current_date,
  meal_index int NOT NULL,
  meal_name text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mmc_plan_source_check CHECK (plan_source IN ('member_fitness_plans','diet_plans')),
  CONSTRAINT mmc_unique UNIQUE (member_id, plan_source, plan_id, meal_date, meal_index)
);

CREATE INDEX IF NOT EXISTS mmc_member_plan_idx
  ON public.member_meal_completions(member_id, plan_source, plan_id);
CREATE INDEX IF NOT EXISTS mmc_meal_date_idx
  ON public.member_meal_completions(meal_date);

ALTER TABLE public.member_meal_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage own meal completions" ON public.member_meal_completions;
CREATE POLICY "Members manage own meal completions"
  ON public.member_meal_completions
  FOR ALL TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()))
  WITH CHECK (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Staff view meal completions" ON public.member_meal_completions;
CREATE POLICY "Staff view meal completions"
  ON public.member_meal_completions
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer']::app_role[]));

-- ============================================================
-- 4. member_meal_swaps
-- ============================================================
CREATE TABLE IF NOT EXISTS public.member_meal_swaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  plan_source text NOT NULL DEFAULT 'member_fitness_plans',
  plan_id uuid NOT NULL,
  meal_index int NOT NULL,
  original_meal jsonb,
  new_meal jsonb NOT NULL,
  catalog_meal_id uuid REFERENCES public.meal_catalog(id) ON DELETE SET NULL,
  swapped_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mms_plan_source_check CHECK (plan_source IN ('member_fitness_plans','diet_plans'))
);

CREATE INDEX IF NOT EXISTS mms_member_plan_idx
  ON public.member_meal_swaps(member_id, plan_source, plan_id);
CREATE INDEX IF NOT EXISTS mms_swapped_at_idx ON public.member_meal_swaps(swapped_at);

ALTER TABLE public.member_meal_swaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage own meal swaps" ON public.member_meal_swaps;
CREATE POLICY "Members manage own meal swaps"
  ON public.member_meal_swaps
  FOR ALL TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()))
  WITH CHECK (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Staff view meal swaps" ON public.member_meal_swaps;
CREATE POLICY "Staff view meal swaps"
  ON public.member_meal_swaps
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer']::app_role[]));
