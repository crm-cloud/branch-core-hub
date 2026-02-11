
ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
