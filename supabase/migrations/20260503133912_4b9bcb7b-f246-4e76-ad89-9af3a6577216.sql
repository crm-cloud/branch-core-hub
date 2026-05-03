-- Daily reconciliation: re-evaluate hardware/MIPS access for any member whose
-- membership state likely transitions today (start_date hits today, end_date passed,
-- or a freeze window opens/closes). Uses the existing evaluate_member_access_state
-- RPC so all logic and audit trail remain centralized.

CREATE OR REPLACE FUNCTION public.daily_reconcile_member_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_count int := 0;
BEGIN
  FOR v_member_id IN
    SELECT DISTINCT ms.member_id
    FROM public.memberships ms
    WHERE
      -- Membership starts today → access should turn on
      (ms.status = 'active'::public.membership_status AND ms.start_date = current_date)
      -- Membership ended yesterday → access should turn off
      OR (ms.status IN ('active'::public.membership_status, 'frozen'::public.membership_status)
          AND ms.end_date = current_date - 1)
      -- Any currently active/frozen membership → safe nightly recheck (handles overdue grace)
      OR (ms.status IN ('active'::public.membership_status, 'frozen'::public.membership_status)
          AND ms.start_date <= current_date
          AND COALESCE(ms.end_date, current_date) >= current_date)
  LOOP
    BEGIN
      PERFORM public.evaluate_member_access_state(v_member_id, NULL,
        'Daily access reconciliation', false);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Don't let one bad row break the batch
      NULL;
    END;
  END LOOP;

  IF v_count > 0 THEN
    INSERT INTO public.audit_logs (action, table_name, user_id, actor_name, action_description)
    VALUES ('AUTO_ACCESS_RECONCILE', 'members', NULL, 'System',
            'Daily reconciled hardware access for ' || v_count || ' member(s)');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.daily_reconcile_member_access() TO service_role;

-- Schedule it (00:05 daily UTC, just after auto_expire runs at 01:00 UTC we also
-- want to flip *new* starts at midnight). Use 00:05 UTC for start-of-day flips.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule(jobid)
      FROM cron.job WHERE jobname = 'daily-reconcile-member-access';

    PERFORM cron.schedule(
      'daily-reconcile-member-access',
      '5 0 * * *',
      $cron$ SELECT public.daily_reconcile_member_access(); $cron$
    );
  END IF;
END $$;