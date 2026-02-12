-- Drop the problematic unique constraint that prevents multiple custom benefits
-- The constraint on (plan_id, benefit_type) fails when multiple benefits map to 'other'
ALTER TABLE public.plan_benefits DROP CONSTRAINT IF EXISTS plan_benefits_plan_id_benefit_type_key;

-- Add a new unique constraint that accounts for benefit_type_id
-- This allows multiple 'other' benefit_types as long as benefit_type_id differs
CREATE UNIQUE INDEX plan_benefits_plan_id_benefit_type_id_key 
ON public.plan_benefits (plan_id, COALESCE(benefit_type_id, '00000000-0000-0000-0000-000000000000'::uuid), benefit_type);