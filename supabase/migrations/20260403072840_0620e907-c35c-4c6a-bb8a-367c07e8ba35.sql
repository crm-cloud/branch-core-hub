
-- 1. Fix trainers: remove anon-accessible policy, replace with authenticated-only
DROP POLICY IF EXISTS "view_active_trainers" ON public.trainers;

CREATE POLICY "Authenticated users can view active trainers"
ON public.trainers
FOR SELECT
TO authenticated
USING (is_active = true);

-- 2. Fix device_commands: restrict UPDATE to staff roles
DROP POLICY IF EXISTS "Authenticated users can update device_commands" ON public.device_commands;

CREATE POLICY "Staff can update device_commands"
ON public.device_commands
FOR UPDATE
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

-- 3. Fix follow_up_activities: restrict to staff roles
DROP POLICY IF EXISTS "Staff can manage follow-ups" ON public.follow_up_activities;

CREATE POLICY "Staff can manage follow-ups"
ON public.follow_up_activities
FOR ALL
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));
