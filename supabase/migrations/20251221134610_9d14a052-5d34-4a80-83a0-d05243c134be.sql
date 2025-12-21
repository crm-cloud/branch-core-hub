-- Drop existing SELECT policies on members
DROP POLICY IF EXISTS "Members view own" ON public.members;
DROP POLICY IF EXISTS "Staff view branch members" ON public.members;

-- Create combined SELECT policy that allows:
-- 1. Members to view their own record
-- 2. Owners/admins to view all members
-- 3. Staff to view their branch members
CREATE POLICY "View members policy" ON public.members
FOR SELECT USING (
  user_id = auth.uid()
  OR has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[])
  OR branch_id = get_user_branch(auth.uid())
  OR manages_branch(auth.uid(), branch_id)
);