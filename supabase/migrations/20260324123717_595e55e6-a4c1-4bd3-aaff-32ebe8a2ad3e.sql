
ALTER TABLE public.members 
  ADD COLUMN IF NOT EXISTS mips_person_id text,
  ADD COLUMN IF NOT EXISTS mips_sync_status text DEFAULT 'pending';

ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS mips_person_id text,
  ADD COLUMN IF NOT EXISTS mips_sync_status text DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_members_mips_person_id ON public.members(mips_person_id) WHERE mips_person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_mips_person_id ON public.employees(mips_person_id) WHERE mips_person_id IS NOT NULL;
