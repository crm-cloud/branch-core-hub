
-- Add source column to error_logs for tracking origin (frontend, edge_function, database, trigger)
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS source text DEFAULT 'frontend';

-- Add void fields to payments for correction workflow
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS void_reason text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS voided_by uuid;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS original_payment_id uuid REFERENCES public.payments(id);

-- Create a DB function to fetch inactive members (no attendance in last N days)
CREATE OR REPLACE FUNCTION public.get_inactive_members(p_branch_id uuid, p_days integer DEFAULT 7, p_limit integer DEFAULT 50)
RETURNS TABLE(
  member_id uuid,
  member_code text,
  full_name text,
  phone text,
  email text,
  last_visit timestamptz,
  days_absent integer
)
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
  ORDER BY ma.last_check_in ASC NULLS FIRST
  LIMIT p_limit;
END;
$$;
