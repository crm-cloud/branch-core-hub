
-- 1) Fix log_error_event ON CONFLICT predicate to exactly match partial unique index
CREATE OR REPLACE FUNCTION public.log_error_event(
  p_severity text, p_source text, p_message text,
  p_function_name text DEFAULT NULL, p_route text DEFAULT NULL,
  p_table_name text DEFAULT NULL, p_branch_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL, p_request_id text DEFAULT NULL,
  p_release_sha text DEFAULT NULL, p_stack text DEFAULT NULL,
  p_context jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
    p_route, p_function_name, p_table_name,
    p_branch_id, p_user_id, p_request_id, p_release_sha, p_context,
    'open', v_fp, 1, now(), now()
  )
  ON CONFLICT (fingerprint) WHERE (status = 'open' AND fingerprint IS NOT NULL)
  DO UPDATE SET
    occurrence_count = public.error_logs.occurrence_count + 1,
    last_seen = now(),
    context = COALESCE(EXCLUDED.context, public.error_logs.context)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 2) Fix payment_reminders reminder_type values used by purchase_member_membership.
-- Broaden CHECK to accept both legacy and new labels so existing/new code both work.
ALTER TABLE public.payment_reminders DROP CONSTRAINT IF EXISTS payment_reminders_reminder_type_check;
ALTER TABLE public.payment_reminders ADD CONSTRAINT payment_reminders_reminder_type_check
  CHECK (reminder_type = ANY (ARRAY[
    'due_soon','on_due','overdue','final_notice',
    'payment_due'
  ]));
