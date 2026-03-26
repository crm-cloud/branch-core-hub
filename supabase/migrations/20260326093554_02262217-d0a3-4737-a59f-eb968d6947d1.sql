ALTER TABLE public.trainers 
ADD COLUMN IF NOT EXISTS mips_sync_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS mips_person_id text;