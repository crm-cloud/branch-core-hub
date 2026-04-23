-- Optional back-reference from a member's assigned plan to the originating
-- fitness_plan_template. Lets the UI surface "X members are on Template A"
-- and offer a one-click re-sync from template.
ALTER TABLE public.member_fitness_plans
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.fitness_plan_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_member_fitness_plans_template_id
  ON public.member_fitness_plans (template_id)
  WHERE template_id IS NOT NULL;
