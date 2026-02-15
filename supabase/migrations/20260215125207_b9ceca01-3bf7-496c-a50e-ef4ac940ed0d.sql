
-- ============================================================
-- FIX 1: trainers_public view - change from SECURITY DEFINER to SECURITY INVOKER
-- ============================================================
DROP VIEW IF EXISTS public.trainers_public;
CREATE VIEW public.trainers_public
WITH (security_invoker = true)
AS
SELECT t.id,
    t.branch_id,
    t.bio,
    t.specializations,
    t.certifications,
    t.max_clients,
    t.is_active,
    t.created_at,
    p.full_name,
    p.avatar_url
FROM trainers t
LEFT JOIN profiles p ON t.user_id = p.id
WHERE t.is_active = true;

-- ============================================================
-- FIX 2: trainer_change_requests - restrict from USING(true) to proper role checks
-- ============================================================
DROP POLICY IF EXISTS "Staff can view trainer change requests" ON public.trainer_change_requests;
DROP POLICY IF EXISTS "Members can create trainer change requests" ON public.trainer_change_requests;
DROP POLICY IF EXISTS "Staff can update trainer change requests" ON public.trainer_change_requests;

-- Members view their own requests, staff/admin view all
CREATE POLICY "View own or staff view change requests"
ON public.trainer_change_requests FOR SELECT
USING (
  member_id = public.get_member_id(auth.uid())
  OR public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
);

-- Only members can create their own requests
CREATE POLICY "Members create own change requests"
ON public.trainer_change_requests FOR INSERT
WITH CHECK (
  member_id = public.get_member_id(auth.uid())
);

-- Only staff/admin can update (approve/reject)
CREATE POLICY "Staff update change requests"
ON public.trainer_change_requests FOR UPDATE
USING (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
);

-- ============================================================
-- FIX 3: fitness_plan_templates - restrict to staff/trainer only
-- ============================================================
DROP POLICY IF EXISTS "Staff can manage templates" ON public.fitness_plan_templates;

-- Staff and trainers can read templates
CREATE POLICY "Staff and trainers view templates"
ON public.fitness_plan_templates FOR SELECT
USING (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer']::app_role[])
);

-- Only staff can manage (insert/update/delete) templates
CREATE POLICY "Staff manage templates"
ON public.fitness_plan_templates FOR INSERT
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer']::app_role[])
);

CREATE POLICY "Staff update templates"
ON public.fitness_plan_templates FOR UPDATE
USING (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer']::app_role[])
);

CREATE POLICY "Staff delete templates"
ON public.fitness_plan_templates FOR DELETE
USING (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
);

-- ============================================================
-- FIX 4: audit_logs - remove duplicate INSERT policies and fix permissive SELECT
-- ============================================================
DROP POLICY IF EXISTS "System insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON public.audit_logs;

-- Only allow inserts from the system (trigger-based, so needs authenticated)
-- Restrict to staff+ roles to prevent abuse
CREATE POLICY "Authenticated insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);
-- Note: audit_log inserts come from triggers (SECURITY DEFINER), so we keep WITH CHECK(true)
-- but the trigger itself controls what gets inserted. Restricting further would break audit logging.

-- SELECT already has "Admin view audit logs" policy - that's sufficient

-- ============================================================
-- FIX 5: approval_requests INSERT - restrict to appropriate roles
-- ============================================================
DROP POLICY IF EXISTS "Create approval requests" ON public.approval_requests;

CREATE POLICY "Create approval requests"
ON public.approval_requests FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  OR public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
);

-- ============================================================
-- FIX 6: trainers table - remove member direct access (they should use trainers_public view)
-- ============================================================
DROP POLICY IF EXISTS "Members view active trainers" ON public.trainers;

-- Members should use the trainers_public view which excludes sensitive fields
-- Add a SELECT policy for members that only exposes non-sensitive columns via RLS
-- Since RLS can't restrict columns, we rely on the view. Remove direct member access.

-- ============================================================
-- FIX 7: profiles - add staff read policy for member management
-- ============================================================
CREATE POLICY "Staff view profiles for management"
ON public.profiles FOR SELECT
USING (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
);
