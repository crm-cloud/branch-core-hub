
INSERT INTO public.role_capabilities(role, capability) VALUES
  ('owner','manage_automations'),
  ('admin','manage_automations')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'system',
  worker text NOT NULL,
  worker_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  cron_expression text NOT NULL DEFAULT '0 9 * * *',
  is_active boolean NOT NULL DEFAULT true,
  use_ai boolean NOT NULL DEFAULT false,
  ai_tone text DEFAULT 'friendly',
  target_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_at timestamptz,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_status text,
  last_error text,
  last_dispatched_count int DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, key)
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_active_next
  ON public.automation_rules (is_active, next_run_at);

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  branch_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  dispatched_count int DEFAULT 0,
  error_message text,
  payload jsonb
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_rule_started
  ON public.automation_runs (rule_id, started_at DESC);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_rules_select ON public.automation_rules;
CREATE POLICY automation_rules_select ON public.automation_rules
  FOR SELECT TO authenticated
  USING (
    public.has_capability(auth.uid(),'manage_automations')
    OR (branch_id IS NULL AND public.has_capability(auth.uid(),'manage_settings'))
    OR (branch_id IS NOT NULL AND branch_id = public.get_user_branch(auth.uid()))
  );

DROP POLICY IF EXISTS automation_rules_write ON public.automation_rules;
CREATE POLICY automation_rules_write ON public.automation_rules
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(),'manage_automations'))
  WITH CHECK (public.has_capability(auth.uid(),'manage_automations'));

DROP POLICY IF EXISTS automation_runs_select ON public.automation_runs;
CREATE POLICY automation_runs_select ON public.automation_runs
  FOR SELECT TO authenticated
  USING (
    public.has_capability(auth.uid(),'manage_automations')
    OR (branch_id IS NOT NULL AND branch_id = public.get_user_branch(auth.uid()))
  );

DROP TRIGGER IF EXISTS trg_automation_rules_updated ON public.automation_rules;
CREATE TRIGGER trg_automation_rules_updated
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.admin_toggle_automation_rule(_rule_id uuid, _active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_capability(auth.uid(),'manage_automations') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.automation_rules SET is_active = _active WHERE id = _rule_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_automation_rule(
  _rule_id uuid,
  _cron_expression text,
  _use_ai boolean,
  _ai_tone text,
  _target_filter jsonb,
  _name text DEFAULT NULL,
  _description text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_capability(auth.uid(),'manage_automations') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.automation_rules
    SET cron_expression = COALESCE(_cron_expression, cron_expression),
        use_ai = COALESCE(_use_ai, use_ai),
        ai_tone = COALESCE(_ai_tone, ai_tone),
        target_filter = COALESCE(_target_filter, target_filter),
        name = COALESCE(_name, name),
        description = COALESCE(_description, description),
        next_run_at = LEAST(next_run_at, now() + interval '1 minute')
   WHERE id = _rule_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_run_automation_now(_rule_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_capability(auth.uid(),'manage_automations') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.automation_rules
     SET next_run_at = now() - interval '1 second'
   WHERE id = _rule_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_toggle_automation_rule(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_automation_rule(uuid,text,boolean,text,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_run_automation_now(uuid) TO authenticated;

INSERT INTO public.automation_rules
  (branch_id, key, name, description, category, worker, worker_payload, cron_expression, is_system, use_ai)
VALUES
  (NULL,'daily_send_reminders','Daily Reminders','Membership renewal, expiry & overdue reminders.','billing','edge:send-reminders','{"time":"scheduled"}','0 8 * * *',true,false),
  (NULL,'benefit_t2h_reminders','Booking Reminders (T-2h)','Reminds members 2 hours before booked sessions.','booking','edge:send-reminders','{"mode":"benefit_t2h"}','*/30 * * * *',true,false),
  (NULL,'mark_no_show_bookings','Mark No-Show Bookings','Marks past unattended bookings as no-show.','booking','rpc:mark_no_show_bookings','{}','*/15 * * * *',true,false),
  (NULL,'auto_expire_memberships','Auto-Expire Memberships','Marks memberships expired when end date passes.','lifecycle','rpc:auto_expire_memberships','{}','0 1 * * *',true,false),
  (NULL,'generate_renewal_invoices','Generate Renewal Invoices','Creates renewal invoices for memberships expiring soon.','billing','rpc:generate_renewal_invoices','{}','0 2 * * *',true,false),
  (NULL,'daily_reconcile_member_access','Reconcile Member Access','Daily access sync against device roster.','lifecycle','rpc:daily_reconcile_member_access','{}','5 0 * * *',true,false),
  (NULL,'reconcile_payments','Reconcile Payments','Reconciles payment gateway settlements.','billing','edge:reconcile-payments','{}','0 21 * * *',true,false),
  (NULL,'lead_nurture_followup','AI Lead Nurture','AI-personalised follow-ups for leads in the pipeline.','engagement','edge:lead-nurture-followup','{"triggered_by":"automation-brain"}','0 * * * *',true,true),
  (NULL,'run_retention_nudges','Smart Retention Nudges','Re-engages absent members with tiered nudges.','engagement','edge:run-retention-nudges','{}','0 9 * * *',true,true),
  (NULL,'process_scheduled_campaigns','Process Scheduled Campaigns','Sends marketing campaigns at their scheduled time.','engagement','edge:process-scheduled-campaigns','{}','* * * * *',true,false),
  (NULL,'process_comm_retry_queue','Communication Retry Queue','Retries failed email/SMS/in-app deliveries.','system','edge:process-comm-retry-queue','{"source":"automation-brain"}','*/5 * * * *',true,false),
  (NULL,'process_whatsapp_retry_queue','WhatsApp Retry Queue','Retries failed WhatsApp deliveries.','system','edge:process-whatsapp-retry-queue','{}','*/2 * * * *',true,false),
  (NULL,'birthday_wish','Birthday Wishes','Sends birthday greetings to members on their special day.','engagement','builtin:birthday_wish','{}','30 9 * * *',true,true)
ON CONFLICT (branch_id, key) DO NOTHING;

DO $mig$
DECLARE j text;
BEGIN
  FOREACH j IN ARRAY ARRAY[
    'daily-send-reminders','benefit-t2h-reminders','mark-no-show-bookings',
    'daily-auto-expire-memberships','generate-renewal-invoices','daily-reconcile-member-access',
    'reconcile-payments-daily','lead-nurture-followup-hourly','run-retention-nudges-daily',
    'process-scheduled-campaigns','process-comm-retry-queue','process-whatsapp-retry-queue',
    'automation-brain-tick'
  ]
  LOOP
    BEGIN PERFORM cron.unschedule(j); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;

  PERFORM cron.schedule(
    'automation-brain-tick',
    '*/5 * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/automation-brain',
        headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5cXFwYnZuc3p5cnJnZXJuaW9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzE1NjIsImV4cCI6MjA4MTgwNzU2Mn0.EAmMC21oRiyV8sgixS8eQE3-b17_-Y9kn2-os8fv0Eo"}'::jsonb,
        body := '{"source":"cron"}'::jsonb,
        timeout_milliseconds := 55000
      );
    $cron$
  );
END $mig$;
