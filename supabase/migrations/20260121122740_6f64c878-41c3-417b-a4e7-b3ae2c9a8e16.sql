-- Drop existing search_members function first
DROP FUNCTION IF EXISTS search_members(text, uuid, integer);

-- Create search_members function with correct signature
CREATE OR REPLACE FUNCTION search_members(
  search_term text,
  p_branch_id uuid DEFAULT NULL,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  member_code text,
  full_name text,
  phone text,
  email text,
  avatar_url text,
  branch_id uuid
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.member_code,
    COALESCE(p.full_name, 'Unknown') as full_name,
    p.phone,
    p.email,
    p.avatar_url,
    m.branch_id
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
$$ LANGUAGE plpgsql SECURITY DEFINER;