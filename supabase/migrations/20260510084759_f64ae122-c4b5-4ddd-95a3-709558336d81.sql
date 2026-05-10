DROP TABLE IF EXISTS public.workout_plans CASCADE;
DROP TABLE IF EXISTS public.workout_templates CASCADE;
DROP TABLE IF EXISTS public.diet_templates CASCADE;
DROP TABLE IF EXISTS public.ai_plan_logs CASCADE;
DROP TABLE IF EXISTS public.exercises CASCADE;

ALTER TABLE public.member_workout_completions
  DROP CONSTRAINT IF EXISTS member_workout_completions_plan_source_check;
ALTER TABLE public.member_workout_completions
  ADD CONSTRAINT member_workout_completions_plan_source_check
  CHECK (plan_source = 'member_fitness_plans');