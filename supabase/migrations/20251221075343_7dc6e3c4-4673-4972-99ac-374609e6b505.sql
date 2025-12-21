-- Add new benefit types to enum
ALTER TYPE benefit_type ADD VALUE IF NOT EXISTS 'ice_bath';
ALTER TYPE benefit_type ADD VALUE IF NOT EXISTS 'yoga_class';
ALTER TYPE benefit_type ADD VALUE IF NOT EXISTS 'crossfit_class';
ALTER TYPE benefit_type ADD VALUE IF NOT EXISTS 'spa_access';
ALTER TYPE benefit_type ADD VALUE IF NOT EXISTS 'sauna_session';
ALTER TYPE benefit_type ADD VALUE IF NOT EXISTS 'cardio_area';
ALTER TYPE benefit_type ADD VALUE IF NOT EXISTS 'functional_training';

-- Create expense categories table (if not exists with enhanced structure)
CREATE TABLE IF NOT EXISTS public.expense_category_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  icon TEXT,
  color TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default categories
INSERT INTO public.expense_category_templates (name, type, icon, color, is_system) VALUES
  ('Membership Revenue', 'income', 'CreditCard', 'hsl(142, 76%, 36%)', true),
  ('PT Session Revenue', 'income', 'Dumbbell', 'hsl(142, 76%, 36%)', true),
  ('Product Sales', 'income', 'ShoppingBag', 'hsl(142, 76%, 36%)', true),
  ('Class Fees', 'income', 'Calendar', 'hsl(142, 76%, 36%)', true),
  ('Locker Rentals', 'income', 'Lock', 'hsl(142, 76%, 36%)', true),
  ('Other Income', 'income', 'Plus', 'hsl(142, 76%, 36%)', true),
  ('Staff Salaries', 'expense', 'Users', 'hsl(0, 84%, 60%)', true),
  ('Rent', 'expense', 'Building2', 'hsl(0, 84%, 60%)', true),
  ('Utilities', 'expense', 'Zap', 'hsl(0, 84%, 60%)', true),
  ('Equipment', 'expense', 'Wrench', 'hsl(0, 84%, 60%)', true),
  ('Maintenance', 'expense', 'Wrench', 'hsl(0, 84%, 60%)', true),
  ('Marketing', 'expense', 'Megaphone', 'hsl(0, 84%, 60%)', true),
  ('Insurance', 'expense', 'Shield', 'hsl(0, 84%, 60%)', true),
  ('Supplies', 'expense', 'Package', 'hsl(0, 84%, 60%)', true),
  ('Other Expense', 'expense', 'Minus', 'hsl(0, 84%, 60%)', true)
ON CONFLICT DO NOTHING;

-- Create member_fitness_plans table for workout/diet plans
CREATE TABLE IF NOT EXISTS public.member_fitness_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('workout', 'diet')),
  plan_name TEXT NOT NULL,
  description TEXT,
  plan_data JSONB NOT NULL DEFAULT '{}',
  is_custom BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  valid_from DATE,
  valid_until DATE,
  created_by UUID,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on member_fitness_plans
ALTER TABLE public.member_fitness_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies for member_fitness_plans
CREATE POLICY "Staff can manage fitness plans"
  ON public.member_fitness_plans
  FOR ALL
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'trainer']::app_role[])
  );

CREATE POLICY "Members can view their own plans"
  ON public.member_fitness_plans
  FOR SELECT
  USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  );

CREATE POLICY "Members can view public plans"
  ON public.member_fitness_plans
  FOR SELECT
  USING (is_public = true AND member_id IS NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_member_fitness_plans_updated_at
  BEFORE UPDATE ON public.member_fitness_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Enable RLS on expense_category_templates
ALTER TABLE public.expense_category_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view expense categories"
  ON public.expense_category_templates
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage expense categories"
  ON public.expense_category_templates
  FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]));