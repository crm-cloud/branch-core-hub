-- Fix auto_expire_memberships: aggregate functions are not allowed in
-- RETURNING. Rewrite using a CTE so the cron worker stops erroring.
CREATE OR REPLACE FUNCTION public.auto_expire_memberships()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  WITH upd AS (
    UPDATE memberships
       SET status = 'expired'
     WHERE status = 'active'
       AND end_date < CURRENT_DATE
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;

  IF v_count > 0 THEN
    INSERT INTO audit_logs (action, table_name, user_id, actor_name, action_description)
    VALUES ('AUTO_EXPIRE', 'memberships', NULL, 'System',
            'Auto-expired ' || v_count || ' membership(s) past end_date');
  END IF;
END;
$$;