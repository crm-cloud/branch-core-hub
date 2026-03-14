
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS weekly_off TEXT DEFAULT 'sunday';
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS weekly_off TEXT DEFAULT 'sunday';
