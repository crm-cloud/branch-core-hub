-- Drop existing function and recreate with new return type
DROP FUNCTION IF EXISTS public.search_members(text, uuid, integer);

-- Recreate search_members RPC to include member status
CREATE OR REPLACE FUNCTION public.search_members(search_term text, p_branch_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, member_code text, full_name text, phone text, email text, avatar_url text, branch_id uuid, member_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.member_code,
    COALESCE(p.full_name, 'Unknown') as full_name,
    p.phone,
    p.email,
    p.avatar_url,
    m.branch_id,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM memberships ms 
        WHERE ms.member_id = m.id 
          AND ms.status = 'active'
          AND CURRENT_DATE BETWEEN ms.start_date AND ms.end_date
      ) THEN 'active'
      ELSE 'inactive'
    END as member_status
  FROM members m
  LEFT JOIN profiles p ON m.user_id = p.id
  WHERE 
    (p_branch_id IS NULL OR m.branch_id = p_branch_id)
    AND (
      m.member_code ILIKE '%' || search_term || '%'
      OR p.full_name ILIKE '%' || search_term || '%'
      OR p.phone ILIKE '%' || search_term || '%'
      OR p.email ILIKE '%' || search_term || '%'
    )
  ORDER BY p.full_name
  LIMIT p_limit;
END;
$function$;