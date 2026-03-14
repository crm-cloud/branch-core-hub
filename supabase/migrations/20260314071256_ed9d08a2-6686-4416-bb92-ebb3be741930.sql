ALTER TABLE public.staff_attendance ADD CONSTRAINT staff_attendance_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

NOTIFY pgrst, 'reload schema';