CREATE OR REPLACE FUNCTION public.search_command_trainers(
  search_term text,
  p_branch_id uuid DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  full_name text,
  phone text,
  email text,
  is_active boolean,
  branch_id uuid,
  branch_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_term text := COALESCE(NULLIF(trim(search_term), ''), '');
BEGIN
  IF v_uid IS NULL OR length(v_term) < 1 THEN
    RETURN;
  END IF;

  IF NOT public.has_any_role(v_uid, ARRAY['owner','admin','manager','staff','trainer']::app_role[]) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT t.id, p.full_name, p.phone, p.email, t.is_active,
         t.branch_id, b.name AS branch_name
  FROM public.trainers t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN public.branches b ON b.id = t.branch_id
  WHERE t.branch_id IN (SELECT uvb.branch_id FROM public.user_visible_branches(v_uid) uvb)
    AND (p_branch_id IS NULL OR t.branch_id = p_branch_id)
    AND (
      p.full_name ILIKE '%' || v_term || '%'
      OR COALESCE(p.email,'') ILIKE '%' || v_term || '%'
      OR COALESCE(p.phone,'') ILIKE '%' || v_term || '%'
    )
    AND (
      NOT public.has_role(v_uid, 'trainer'::app_role)
      OR public.has_any_role(v_uid, ARRAY['owner','admin','manager','staff']::app_role[])
      OR t.user_id = v_uid
    )
  ORDER BY p.full_name NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 25));
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_command_trainers(text, uuid, int) TO authenticated;