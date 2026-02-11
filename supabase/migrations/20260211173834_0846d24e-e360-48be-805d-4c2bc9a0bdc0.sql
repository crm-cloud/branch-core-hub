
-- Add unique index on (branch_id, benefit_type_id) for benefit_settings upserts using benefit_type_id
CREATE UNIQUE INDEX IF NOT EXISTS benefit_settings_branch_benefit_type_id_idx 
  ON public.benefit_settings (branch_id, benefit_type_id) 
  WHERE benefit_type_id IS NOT NULL;
