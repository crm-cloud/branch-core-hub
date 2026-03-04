
ALTER TABLE public.trainers
  ADD CONSTRAINT trainers_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
