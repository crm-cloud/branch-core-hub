-- P3 — Videos storage, meal catalog seed
-- Adds:
--   1. workout-videos storage bucket (public, 50MB cap, video MIME types) with RLS
--      that lets staff/trainers upload and any authenticated user read.
--   2. meal_catalog table seeded with Indian + spec meals, used by the meal
--      swap modal in the diet builder.
--
-- The same bucket is used for meal prep-videos (folder convention: `meals/...`)
-- to avoid policy duplication, per the spec ("the same storage approach (or a
-- sibling bucket)").

-- ============================================================
-- 1. workout-videos storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workout-videos',
  'workout-videos',
  true,
  52428800, -- 50 MB
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Staff and trainers can upload workout videos" ON storage.objects;
CREATE POLICY "Staff and trainers can upload workout videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'workout-videos'
  AND public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer']::app_role[])
);

DROP POLICY IF EXISTS "Staff and trainers can update workout videos" ON storage.objects;
CREATE POLICY "Staff and trainers can update workout videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'workout-videos'
  AND public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer']::app_role[])
);

DROP POLICY IF EXISTS "Staff and trainers can delete workout videos" ON storage.objects;
CREATE POLICY "Staff and trainers can delete workout videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'workout-videos'
  AND public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer']::app_role[])
);

DROP POLICY IF EXISTS "Authenticated can read workout videos" ON storage.objects;
CREATE POLICY "Authenticated can read workout videos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'workout-videos');

-- ============================================================
-- 2. meal_catalog table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meal_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dietary_type TEXT NOT NULL CHECK (dietary_type IN ('vegetarian','non_vegetarian','vegan','pescatarian')),
  cuisine TEXT NOT NULL CHECK (cuisine IN ('indian','indian_modern','continental','asian','mediterranean','mixed')),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack','pre_workout','post_workout')),
  default_quantity TEXT,
  calories INTEGER NOT NULL DEFAULT 0,
  protein NUMERIC(6,2) NOT NULL DEFAULT 0,
  carbs NUMERIC(6,2) NOT NULL DEFAULT 0,
  fats NUMERIC(6,2) NOT NULL DEFAULT 0,
  fiber NUMERIC(6,2) NOT NULL DEFAULT 0,
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_catalog_filters
  ON public.meal_catalog (dietary_type, cuisine, meal_type, is_active);
CREATE INDEX IF NOT EXISTS idx_meal_catalog_branch ON public.meal_catalog (branch_id);

ALTER TABLE public.meal_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read meal_catalog" ON public.meal_catalog;
CREATE POLICY "Authenticated can read meal_catalog"
ON public.meal_catalog FOR SELECT
TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Staff manage meal_catalog" ON public.meal_catalog;
CREATE POLICY "Staff manage meal_catalog"
ON public.meal_catalog FOR ALL
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_meal_catalog_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_meal_catalog ON public.meal_catalog;
CREATE TRIGGER trg_touch_meal_catalog
BEFORE UPDATE ON public.meal_catalog
FOR EACH ROW EXECUTE FUNCTION public.touch_meal_catalog_updated_at();

-- ============================================================
-- 3. Seed a representative Indian + spec meal catalog (global)
-- ============================================================
INSERT INTO public.meal_catalog
  (branch_id, name, dietary_type, cuisine, meal_type, default_quantity, calories, protein, carbs, fats, fiber, tags)
VALUES
  -- Breakfast
  (NULL, 'Vegetable Poha',                'vegetarian',     'indian', 'breakfast', '1 bowl (200g)',  280, 7,  48, 7,  4, ARRAY['light','classic']),
  (NULL, 'Masala Oats',                   'vegetarian',     'indian', 'breakfast', '1 bowl (60g dry)', 320, 12, 50, 8,  6, ARRAY['high_fiber']),
  (NULL, 'Moong Dal Chilla (2 pcs)',      'vegetarian',     'indian', 'breakfast', '2 chillas',      300, 18, 36, 8,  6, ARRAY['high_protein']),
  (NULL, 'Idli with Sambar (3 pcs)',      'vegetarian',     'indian', 'breakfast', '3 idlis + sambar', 350, 12, 60, 6,  5, ARRAY['fermented']),
  (NULL, 'Egg Bhurji + 2 Roti',           'non_vegetarian', 'indian', 'breakfast', '2 eggs + 2 roti', 480, 26, 50, 18, 5, ARRAY['high_protein']),
  (NULL, 'Paneer Paratha (2 pcs)',        'vegetarian',     'indian', 'breakfast', '2 parathas',     520, 22, 56, 22, 5, ARRAY['filling']),
  (NULL, 'Greek Yoghurt + Banana + Nuts', 'vegetarian',     'continental', 'breakfast', '1 bowl',    340, 18, 38, 12, 4, ARRAY['quick']),
  (NULL, 'Vegan Tofu Scramble',           'vegan',          'continental', 'breakfast', '150g tofu', 280, 20, 12, 16, 3, ARRAY['vegan','high_protein']),

  -- Lunch
  (NULL, 'Dal Tadka + 2 Roti + Salad',    'vegetarian',     'indian', 'lunch', '1 bowl + 2 roti', 520, 22, 78, 12, 10, ARRAY['classic']),
  (NULL, 'Rajma Chawal',                  'vegetarian',     'indian', 'lunch', '1 bowl + 1 cup rice', 580, 22, 96, 10, 12, ARRAY['comfort']),
  (NULL, 'Chole + 2 Roti',                'vegetarian',     'indian', 'lunch', '1 bowl + 2 roti', 560, 22, 84, 14,  12, ARRAY['high_fiber']),
  (NULL, 'Grilled Chicken + Brown Rice',  'non_vegetarian', 'indian_modern', 'lunch', '150g + 1 cup', 620, 42, 72, 16, 5, ARRAY['high_protein','lean']),
  (NULL, 'Fish Curry + Rice',             'pescatarian',    'indian', 'lunch', '150g fish + 1 cup rice', 600, 38, 78, 14, 4, ARRAY['omega3']),
  (NULL, 'Paneer Bhurji + 2 Roti',        'vegetarian',     'indian', 'lunch', '150g + 2 roti', 600, 28, 56, 26, 6, ARRAY['high_protein']),
  (NULL, 'Quinoa Buddha Bowl',            'vegan',          'continental', 'lunch', '1 large bowl', 520, 20, 70, 18, 12, ARRAY['vegan','clean']),

  -- Dinner
  (NULL, 'Mixed Veg Sabzi + 2 Roti',      'vegetarian',     'indian', 'dinner', '1 bowl + 2 roti', 480, 16, 70, 14, 10, ARRAY['light']),
  (NULL, 'Khichdi + Curd',                'vegetarian',     'indian', 'dinner', '1 bowl + 100g curd', 460, 18, 72, 10, 8, ARRAY['light','easy_digest']),
  (NULL, 'Tandoori Chicken + Salad',      'non_vegetarian', 'indian', 'dinner', '200g chicken', 480, 52, 14, 22, 4, ARRAY['high_protein','low_carb']),
  (NULL, 'Palak Paneer + 2 Roti',         'vegetarian',     'indian', 'dinner', '1 bowl + 2 roti', 580, 26, 60, 24, 8, ARRAY['iron_rich']),
  (NULL, 'Grilled Salmon + Veg',          'pescatarian',    'continental', 'dinner', '180g salmon', 540, 40, 18, 32, 5, ARRAY['omega3','keto_friendly']),
  (NULL, 'Tofu Stir Fry + Rice',          'vegan',          'asian', 'dinner', '150g tofu + 1 cup rice', 520, 22, 70, 16, 6, ARRAY['vegan']),

  -- Snack / pre / post workout
  (NULL, 'Roasted Chana (1 fistful)',     'vegetarian',     'indian', 'snack', '40g',           160,  9, 22, 3, 6, ARRAY['light','high_protein']),
  (NULL, 'Sprouts Salad',                 'vegetarian',     'indian', 'snack', '1 bowl',        180, 12, 24, 4, 8, ARRAY['raw','fiber']),
  (NULL, 'Banana + Peanut Butter',        'vegan',          'continental', 'pre_workout', '1 banana + 1 tbsp', 250, 6, 32, 12, 4, ARRAY['energy']),
  (NULL, 'Whey Protein Shake',            'vegetarian',     'mixed', 'post_workout', '1 scoop + water',  140, 27,  5, 2, 0, ARRAY['recovery','high_protein']),
  (NULL, 'Boiled Eggs (3 whole)',         'non_vegetarian', 'mixed', 'post_workout', '3 eggs',         220, 18,  2, 16, 0, ARRAY['high_protein']),
  (NULL, 'Masala Buttermilk',             'vegetarian',     'indian', 'snack', '1 glass',         80,  4,  8, 3, 0, ARRAY['hydrating'])
;
