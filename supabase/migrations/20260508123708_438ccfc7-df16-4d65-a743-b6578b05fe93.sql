CREATE OR REPLACE FUNCTION public.dr_get_or_create_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_token text;
BEGIN
  SELECT token INTO v_token FROM private.dr_config WHERE id = true;
  IF v_token IS NULL THEN
    v_token := gen_random_uuid()::text || '-' || gen_random_uuid()::text;
    INSERT INTO private.dr_config (id, token) VALUES (true, v_token)
    ON CONFLICT (id) DO NOTHING;
    SELECT token INTO v_token FROM private.dr_config WHERE id = true;
  END IF;
  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.dr_get_or_create_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dr_get_or_create_token() TO service_role;