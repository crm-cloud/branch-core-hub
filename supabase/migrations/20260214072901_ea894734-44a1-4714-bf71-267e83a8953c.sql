
-- Drop the old constraint that causes 409 conflicts for custom benefit types
ALTER TABLE benefit_settings 
  DROP CONSTRAINT IF EXISTS benefit_settings_branch_id_benefit_type_key;

-- For rows WITH a benefit_type_id, uniqueness is on (branch_id, benefit_type_id)
CREATE UNIQUE INDEX IF NOT EXISTS benefit_settings_branch_type_id_key 
  ON benefit_settings (branch_id, benefit_type_id) 
  WHERE benefit_type_id IS NOT NULL;

-- For legacy rows WITHOUT a benefit_type_id, keep uniqueness on (branch_id, benefit_type)
CREATE UNIQUE INDEX IF NOT EXISTS benefit_settings_branch_type_enum_key 
  ON benefit_settings (branch_id, benefit_type) 
  WHERE benefit_type_id IS NULL;
