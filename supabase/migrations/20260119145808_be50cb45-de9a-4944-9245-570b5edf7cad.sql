-- Create fitness plan templates table for default/global plans
CREATE TABLE public.fitness_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('workout', 'diet')),
  description TEXT,
  difficulty TEXT DEFAULT 'intermediate' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  goal TEXT,
  content JSONB NOT NULL DEFAULT '{}',
  is_public BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fitness_plan_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fitness_plan_templates
CREATE POLICY "Staff can manage templates" 
ON public.fitness_plan_templates
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Create updated_at trigger for templates
CREATE TRIGGER update_fitness_plan_templates_updated_at
BEFORE UPDATE ON public.fitness_plan_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_fitness_plan_templates_branch ON public.fitness_plan_templates(branch_id);
CREATE INDEX idx_fitness_plan_templates_type ON public.fitness_plan_templates(type);