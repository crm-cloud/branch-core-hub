-- PT Packages enhancements
ALTER TABLE pt_packages ADD COLUMN IF NOT EXISTS session_type text DEFAULT 'per_session';
ALTER TABLE pt_packages ADD COLUMN IF NOT EXISTS gst_inclusive boolean DEFAULT false;
ALTER TABLE pt_packages ADD COLUMN IF NOT EXISTS gst_percentage numeric DEFAULT 18;

-- Trainer enhancements
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS salary_type text DEFAULT 'hourly';
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS fixed_salary numeric;
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS pt_share_percentage numeric DEFAULT 40;
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS government_id_type text;
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS government_id_number text;