
-- 1. Backfill missing profiles for employees, trainers, and user_roles users
INSERT INTO public.profiles (id, email, full_name)
SELECT DISTINCT au.id, au.email, COALESCE(au.raw_user_meta_data->>'full_name', au.email)
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.profiles)
  AND (
    au.id IN (SELECT user_id FROM public.employees WHERE user_id IS NOT NULL)
    OR au.id IN (SELECT user_id FROM public.trainers WHERE user_id IS NOT NULL)
    OR au.id IN (SELECT user_id FROM public.user_roles WHERE user_id IS NOT NULL)
  )
ON CONFLICT (id) DO NOTHING;

-- 2. Add RLS policy: users can insert their own profile row
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON public.profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- 3. Add RLS policy: users can read own profile  
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can read own profile'
  ) THEN
    CREATE POLICY "Users can read own profile"
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (id = auth.uid());
  END IF;
END $$;

-- 4. Ensure staff/admins can read all profiles (for admin views)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Staff can read all profiles'
  ) THEN
    CREATE POLICY "Staff can read all profiles"
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (
        public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff', 'trainer']::app_role[])
      );
  END IF;
END $$;
