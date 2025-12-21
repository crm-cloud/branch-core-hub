-- Add FK so PostgREST can embed profiles via members.user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'members_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.members
      ADD CONSTRAINT members_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members(user_id);

-- (Optional but helpful) Ensure staff_branches can embed branch/user later
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_branches_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.staff_branches
      ADD CONSTRAINT staff_branches_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_staff_branches_user_id ON public.staff_branches(user_id);