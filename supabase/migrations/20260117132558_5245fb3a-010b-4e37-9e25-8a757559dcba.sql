-- Create search_members function for efficient member search across profiles
CREATE OR REPLACE FUNCTION public.search_members(
  search_term text DEFAULT '',
  p_branch_id uuid DEFAULT NULL,
  p_limit int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  member_code text,
  user_id uuid,
  branch_id uuid,
  joined_date date,
  emergency_contact_name text,
  emergency_contact_phone text,
  medical_conditions text,
  is_active boolean,
  referred_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  branch_name text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.member_code,
    m.user_id,
    m.branch_id,
    m.joined_date,
    m.emergency_contact_name,
    m.emergency_contact_phone,
    m.medical_conditions,
    m.is_active,
    m.referred_by,
    m.created_at,
    m.updated_at,
    p.full_name,
    p.email,
    p.phone,
    p.avatar_url,
    b.name as branch_name
  FROM members m
  LEFT JOIN profiles p ON m.user_id = p.id
  LEFT JOIN branches b ON m.branch_id = b.id
  WHERE 
    (search_term = '' OR
     m.member_code ILIKE '%' || search_term || '%' OR
     p.full_name ILIKE '%' || search_term || '%' OR
     p.email ILIKE '%' || search_term || '%' OR
     p.phone ILIKE '%' || search_term || '%')
    AND (p_branch_id IS NULL OR m.branch_id = p_branch_id)
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$$;