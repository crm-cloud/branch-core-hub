
ALTER TABLE public.member_attendance
  ADD COLUMN IF NOT EXISTS force_entry boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS force_entry_reason text,
  ADD COLUMN IF NOT EXISTS force_entry_by uuid REFERENCES public.profiles(id);
