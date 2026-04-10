ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS fitness_goal text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS expected_start_date text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS fitness_experience text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS preferred_time text;