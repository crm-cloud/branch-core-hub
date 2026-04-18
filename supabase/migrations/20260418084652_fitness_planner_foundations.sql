-- P1: Fitness Planner Foundations
-- Adds dietary, cuisine, allergies, fitness level, activity level,
-- equipment availability, and injuries/limitations columns to members.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS dietary_preference text,
  ADD COLUMN IF NOT EXISTS cuisine_preference text,
  ADD COLUMN IF NOT EXISTS allergies text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS fitness_level text,
  ADD COLUMN IF NOT EXISTS activity_level text,
  ADD COLUMN IF NOT EXISTS equipment_availability text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS injuries_limitations text;

-- Loose CHECK constraints reflecting the spec enumerations. NULL allowed because
-- existing rows will not have these set; the UI will progressively backfill.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'members_dietary_preference_check'
  ) THEN
    ALTER TABLE public.members
      ADD CONSTRAINT members_dietary_preference_check
      CHECK (dietary_preference IS NULL OR dietary_preference IN (
        'vegetarian', 'non_vegetarian', 'vegan', 'pescatarian'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'members_cuisine_preference_check'
  ) THEN
    ALTER TABLE public.members
      ADD CONSTRAINT members_cuisine_preference_check
      CHECK (cuisine_preference IS NULL OR cuisine_preference IN (
        'indian', 'indian_modern', 'continental', 'asian', 'mediterranean', 'mixed'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'members_fitness_level_check'
  ) THEN
    ALTER TABLE public.members
      ADD CONSTRAINT members_fitness_level_check
      CHECK (fitness_level IS NULL OR fitness_level IN (
        'beginner', 'intermediate', 'advanced'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'members_activity_level_check'
  ) THEN
    ALTER TABLE public.members
      ADD CONSTRAINT members_activity_level_check
      CHECK (activity_level IS NULL OR activity_level IN (
        'sedentary', 'light', 'moderate', 'very_active', 'extra_active'
      ));
  END IF;
END $$;

COMMENT ON COLUMN public.members.dietary_preference IS 'vegetarian | non_vegetarian | vegan | pescatarian';
COMMENT ON COLUMN public.members.cuisine_preference IS 'indian | indian_modern | continental | asian | mediterranean | mixed';
COMMENT ON COLUMN public.members.allergies IS 'Free-form allergy tags (e.g. peanuts, dairy, gluten).';
COMMENT ON COLUMN public.members.fitness_level IS 'beginner | intermediate | advanced';
COMMENT ON COLUMN public.members.activity_level IS 'sedentary | light | moderate | very_active | extra_active';
COMMENT ON COLUMN public.members.equipment_availability IS 'Equipment access tags (e.g. full_gym, home_dumbbells, bodyweight_only, resistance_bands).';
COMMENT ON COLUMN public.members.injuries_limitations IS 'Free-text injuries / physical limitations to consider when planning.';
