CREATE OR REPLACE FUNCTION public.get_online_users(stale_minutes integer DEFAULT 5)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  roles text[],
  last_seen_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    p.full_name,
    p.avatar_url,
    COALESCE(ARRAY(
      SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.id
    ), ARRAY[]::text[]) AS roles,
    p.last_seen_at
  FROM public.profiles p
  WHERE p.last_seen_at IS NOT NULL
    AND p.last_seen_at > now() - make_interval(mins => GREATEST(stale_minutes, 1))
    AND auth.uid() IS NOT NULL
  ORDER BY p.last_seen_at DESC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.get_online_users(integer) TO authenticated;