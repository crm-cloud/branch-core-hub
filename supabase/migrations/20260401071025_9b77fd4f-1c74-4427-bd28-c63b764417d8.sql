
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS meta_template_name text;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS meta_template_status text DEFAULT 'pending';
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS meta_rejection_reason text;
ALTER TABLE public.diet_plans ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'custom';
