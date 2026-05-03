-- Fix trainers REST 403 caused by missing table-level privileges.
-- Existing RLS policies still decide which signed-in users can see rows.
GRANT SELECT ON TABLE public.trainers TO authenticated;

-- Recreate error logger RPC and explicitly expose it to app roles.
-- Uses built-in md5() so it does not depend on optional pgcrypto extensions.
CREATE OR REPLACE FUNCTION public.compute_error_fingerprint(
  p_severity text,
  p_source text,
  p_function_name text,
  p_route text,
  p_message text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT md5(
    coalesce(p_severity, 'error') || '|' ||
    coalesce(p_source, 'unknown') || '|' ||
    coalesce(p_function_name, '') || '|' ||
    coalesce(p_route, '') || '|' ||
    left(coalesce(p_message, ''), 500)
  )
$$;

CREATE OR REPLACE FUNCTION public.log_error_event(
  p_severity text,
  p_source text,
  p_message text,
  p_function_name text DEFAULT NULL::text,
  p_route text DEFAULT NULL::text,
  p_table_name text DEFAULT NULL::text,
  p_branch_id uuid DEFAULT NULL::uuid,
  p_user_id uuid DEFAULT NULL::uuid,
  p_request_id text DEFAULT NULL::text,
  p_release_sha text DEFAULT NULL::text,
  p_stack text DEFAULT NULL::text,
  p_context jsonb DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fp text;
  v_id uuid;
BEGIN
  v_fp := public.compute_error_fingerprint(p_severity, p_source, p_function_name, p_route, p_message);

  INSERT INTO public.error_logs (
    severity, source, error_message, stack_trace, route, function_name, table_name,
    branch_id, user_id, request_id, release_sha, context, status,
    fingerprint, occurrence_count, first_seen, last_seen
  )
  VALUES (
    coalesce(nullif(p_severity, ''), 'error'),
    coalesce(nullif(p_source, ''), 'unknown'),
    left(coalesce(p_message, '(no message)'), 2000),
    left(p_stack, 8000),
    p_route,
    p_function_name,
    p_table_name,
    p_branch_id,
    p_user_id,
    p_request_id,
    p_release_sha,
    p_context,
    'open',
    v_fp,
    1,
    now(),
    now()
  )
  ON CONFLICT (fingerprint) WHERE status = 'open'
  DO UPDATE SET
    occurrence_count = public.error_logs.occurrence_count + 1,
    last_seen = now(),
    context = COALESCE(EXCLUDED.context, public.error_logs.context)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_error_event(text,text,text,text,text,text,uuid,uuid,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_error_event(text,text,text,text,text,text,uuid,uuid,text,text,text,jsonb) TO anon, authenticated, service_role;

-- Fix create-member-user 500: onboard_member currently writes lifecycle_state = 'onboarded'.
-- Keep the accepted lifecycle states aligned with that workflow while preserving existing states.
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_lifecycle_state_check;
ALTER TABLE public.members ADD CONSTRAINT members_lifecycle_state_check
CHECK (lifecycle_state = ANY (ARRAY[
  'created'::text,
  'pending_verification'::text,
  'verified'::text,
  'active'::text,
  'onboarded'::text,
  'suspended'::text,
  'archived'::text
]));

-- Ask PostgREST to refresh schema cache so the RPC is immediately visible.
NOTIFY pgrst, 'reload schema';