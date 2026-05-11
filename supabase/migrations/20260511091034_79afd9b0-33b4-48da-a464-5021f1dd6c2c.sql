
-- Presence tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON public.profiles(last_seen_at DESC) WHERE last_seen_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_presence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.profiles SET last_seen_at = now() WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_presence() TO authenticated;

CREATE OR REPLACE VIEW public.online_users_v
WITH (security_invoker = true)
AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.avatar_url,
  p.last_seen_at,
  COALESCE((SELECT array_agg(ur.role::text) FROM public.user_roles ur WHERE ur.user_id = p.id), ARRAY[]::text[]) AS roles
FROM public.profiles p
WHERE p.last_seen_at IS NOT NULL
  AND p.last_seen_at > now() - interval '5 minutes';

GRANT SELECT ON public.online_users_v TO authenticated;
