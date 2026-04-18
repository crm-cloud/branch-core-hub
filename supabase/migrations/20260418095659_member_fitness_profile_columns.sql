-- Task #5 — Save member fitness preferences so they pre-fill on every plan
--
-- The members table already has columns for fitness_level, equipment_availability,
-- dietary_preference, cuisine_preference, and allergies (added in earlier
-- migrations). This migration is an idempotent safeguard: it ensures every
-- column the MemberProfileCard reads/writes exists with the expected type
-- so deployments missing one of those earlier migrations still work.
--
-- No data is modified.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS fitness_level TEXT,
  ADD COLUMN IF NOT EXISTS equipment_availability TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS dietary_preference TEXT,
  ADD COLUMN IF NOT EXISTS cuisine_preference TEXT,
  ADD COLUMN IF NOT EXISTS allergies TEXT[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.members.fitness_level IS 'Persisted fitness level used to pre-fill plan creation (beginner/intermediate/advanced).';
COMMENT ON COLUMN public.members.equipment_availability IS 'Equipment access tokens used to pre-fill plan creation (e.g. full_gym, home_basic).';
COMMENT ON COLUMN public.members.dietary_preference IS 'Persisted dietary preference (vegetarian, vegan, ...) used to pre-fill plan creation.';
COMMENT ON COLUMN public.members.cuisine_preference IS 'Persisted cuisine preference used to pre-fill plan creation.';
COMMENT ON COLUMN public.members.allergies IS 'Persisted list of allergies used to pre-fill plan creation.';
