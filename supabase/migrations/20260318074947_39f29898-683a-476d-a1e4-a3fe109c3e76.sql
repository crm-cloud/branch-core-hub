-- Add branch_transfer to approval_type enum
ALTER TYPE public.approval_type ADD VALUE IF NOT EXISTS 'branch_transfer';

-- ============================================
-- MEMBERSHIPS TABLE: Split ALL policy into granular policies
-- ============================================

-- Drop the overly permissive ALL policy
DROP POLICY IF EXISTS "Staff manage branch memberships" ON public.memberships;

-- SELECT: kept by existing policies (View own memberships + Staff view branch memberships)

-- INSERT: staff + management can create new memberships
CREATE POLICY "Staff insert memberships" ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
    AND (branch_id = get_user_branch(auth.uid()) OR manages_branch(auth.uid(), branch_id))
  );

-- UPDATE: ONLY management (owner/admin/manager) — staff DENIED
CREATE POLICY "Management update memberships" ON public.memberships
  FOR UPDATE TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[])
    AND (branch_id = get_user_branch(auth.uid()) OR manages_branch(auth.uid(), branch_id))
  );

-- DELETE: only owner/admin
CREATE POLICY "Admin delete memberships" ON public.memberships
  FOR DELETE TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[])
  );

-- ============================================
-- MEMBERS TABLE: Split ALL policy into granular policies
-- ============================================

-- Drop the overly permissive ALL policy
DROP POLICY IF EXISTS "Staff manage branch members" ON public.members;

-- INSERT: staff + management can create new members
CREATE POLICY "Staff insert members" ON public.members
  FOR INSERT TO authenticated
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
    AND (branch_id = get_user_branch(auth.uid()) OR manages_branch(auth.uid(), branch_id))
  );

-- UPDATE: ONLY management — staff DENIED from updating branch_id etc.
CREATE POLICY "Management update members" ON public.members
  FOR UPDATE TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[])
    AND (branch_id = get_user_branch(auth.uid()) OR manages_branch(auth.uid(), branch_id))
  );

-- DELETE: only owner/admin
CREATE POLICY "Admin delete members" ON public.members
  FOR DELETE TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[])
  );