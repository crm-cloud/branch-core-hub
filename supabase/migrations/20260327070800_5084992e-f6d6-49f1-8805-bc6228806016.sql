
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS mips_person_sn text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS mips_person_sn text;
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS mips_person_sn text;

CREATE INDEX IF NOT EXISTS idx_members_mips_person_sn ON public.members(mips_person_sn) WHERE mips_person_sn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_mips_person_sn ON public.employees(mips_person_sn) WHERE mips_person_sn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trainers_mips_person_sn ON public.trainers(mips_person_sn) WHERE mips_person_sn IS NOT NULL;
