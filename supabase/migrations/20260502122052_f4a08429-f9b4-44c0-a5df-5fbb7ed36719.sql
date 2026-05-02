-- 1. TRAINERS: drop the policy that exposed government IDs / salary to all authenticated users
DROP POLICY IF EXISTS "Authenticated users can view active trainers" ON public.trainers;

-- Replace it with a SELECT policy still scoped to active trainers, but enforce column-level
-- protection via GRANTs below so government IDs and salary fields are never readable
-- by the broad `authenticated` role.
CREATE POLICY "Authenticated read active trainers"
ON public.trainers
FOR SELECT
TO authenticated
USING (is_active = true);

-- Hard column-level enforcement: revoke broad SELECT, then re-grant only safe columns.
-- Staff / admin / manager / owner / trainer paths read via the `staff_access_trainers`
-- and `Admin manage trainers` policies which use SECURITY DEFINER role helpers and are
-- not affected by this column GRANT (RLS check passes; column GRANT controls column visibility).
REVOKE SELECT ON public.trainers FROM authenticated;
GRANT SELECT (
  id,
  user_id,
  branch_id,
  specializations,
  certifications,
  bio,
  is_active,
  max_clients,
  weekly_off,
  trainer_code,
  avatar_storage_path,
  biometric_photo_url,
  biometric_photo_path,
  created_at,
  updated_at
) ON public.trainers TO authenticated;

-- 2. HOWBODY PUBLIC REPORT TOKENS: stop exposing the whole token table
DROP POLICY IF EXISTS "Anyone with token can read" ON public.howbody_public_report_tokens;

-- Public report viewer goes through this SECURITY DEFINER function which validates the
-- specific token and returns the matching report payload only.
CREATE OR REPLACE FUNCTION public.get_howbody_public_report(_token text, _report_type text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok record;
  rep jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT data_key, report_type, expires_at
    INTO tok
  FROM public.howbody_public_report_tokens
  WHERE token = _token
  LIMIT 1;

  IF tok IS NULL OR tok.report_type <> _report_type THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_revoked');
  END IF;

  IF tok.expires_at IS NOT NULL AND tok.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  IF _report_type = 'body' THEN
    SELECT to_jsonb(r) INTO rep FROM public.howbody_body_reports r WHERE r.data_key = tok.data_key LIMIT 1;
  ELSIF _report_type = 'posture' THEN
    SELECT to_jsonb(r) INTO rep FROM public.howbody_posture_reports r WHERE r.data_key = tok.data_key LIMIT 1;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_type');
  END IF;

  IF rep IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'report', rep);
END;
$$;

REVOKE ALL ON FUNCTION public.get_howbody_public_report(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_howbody_public_report(text, text) TO anon, authenticated;

-- 3. REFERRAL SETTINGS: replace the truly-true policy with an authenticated-only one
DROP POLICY IF EXISTS "Staff can view referral settings" ON public.referral_settings;

CREATE POLICY "Authenticated can view referral settings"
ON public.referral_settings
FOR SELECT
TO authenticated
USING (true);
