CREATE OR REPLACE FUNCTION public.get_staff_roles_for_branch(p_branch_id uuid)
RETURNS TABLE (user_id uuid, role public.app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id, ur.role
  FROM public.user_roles ur
  WHERE public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::public.app_role[])
    AND ur.user_id IN (
      SELECT e.user_id FROM public.employees e
        WHERE e.branch_id = p_branch_id AND e.is_active = true AND e.user_id IS NOT NULL
      UNION
      SELECT t.user_id FROM public.trainers t
        WHERE t.branch_id = p_branch_id AND t.is_active = true AND t.user_id IS NOT NULL
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_roles_for_branch(uuid) TO authenticated;