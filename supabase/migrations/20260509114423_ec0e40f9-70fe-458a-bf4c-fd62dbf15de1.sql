DROP FUNCTION IF EXISTS public.get_inactive_members(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_inactive_members(p_branch_id uuid, p_days integer DEFAULT 7, p_limit integer DEFAULT 50)
 RETURNS TABLE(member_id uuid, member_code text, full_name text, phone text, email text, avatar_url text, last_visit timestamp with time zone, days_absent integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS member_id,
    m.member_code,
    COALESCE(p.full_name, 'Unknown') AS full_name,
    p.phone,
    p.email,
    p.avatar_url,
    ma.last_check_in AS last_visit,
    EXTRACT(DAY FROM (now() - ma.last_check_in))::integer AS days_absent
  FROM members m
  JOIN profiles p ON p.id = m.user_id
  JOIN memberships ms ON ms.member_id = m.id AND ms.status = 'active' AND ms.end_date >= CURRENT_DATE
  LEFT JOIN LATERAL (
    SELECT MAX(check_in) AS last_check_in
    FROM member_attendance att
    WHERE att.member_id = m.id
  ) ma ON true
  WHERE m.branch_id = p_branch_id
    AND (ma.last_check_in IS NULL OR ma.last_check_in < now() - (p_days || ' days')::interval)
    AND NOT EXISTS (
      SELECT 1 FROM memberships f
      WHERE f.member_id = m.id AND f.status = 'frozen'
    )
  ORDER BY ma.last_check_in ASC NULLS FIRST
  LIMIT p_limit;
END;
$$;