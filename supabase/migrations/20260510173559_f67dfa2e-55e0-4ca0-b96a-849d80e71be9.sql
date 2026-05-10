-- Add PDF-template support to fitness plans
ALTER TABLE public.fitness_plan_templates
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'structured'
    CHECK (source_kind IN ('structured','pdf')),
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS pdf_filename text,
  ADD COLUMN IF NOT EXISTS pdf_size_bytes integer;

ALTER TABLE public.member_fitness_plans
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'structured'
    CHECK (source_kind IN ('structured','pdf')),
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS pdf_filename text,
  ADD COLUMN IF NOT EXISTS pdf_size_bytes integer;

CREATE INDEX IF NOT EXISTS idx_fitness_plan_templates_source ON public.fitness_plan_templates(source_kind);
