
-- ============================================================
-- 1. Seed scan-ready templates for every branch (idempotent)
-- ============================================================
DO $$
DECLARE b RECORD;
BEGIN
  FOR b IN SELECT id FROM public.branches LOOP

    -- BODY SCAN READY (member-facing) -----------------------------------
    INSERT INTO public.templates (branch_id, name, type, subject, content, trigger_event, is_active, variables)
    SELECT b.id, 'Body Scan Ready (Email)', 'email',
           'Your Body Scan Report — {{branch_name}}',
           '<h2>Hi {{member_name}},</h2><p>Your latest body composition scan from <strong>{{branch_name}}</strong> is ready.</p><ul><li>Weight: {{weight}} kg</li><li>BMI: {{bmi}}</li><li>Body Fat: {{body_fat}}%</li><li>Health Score: {{health_score}}</li></ul><p><a href="{{report_url}}">Download Full Report (PDF)</a></p><p style="color:#888;font-size:12px">View your scan history in your member portal under Progress.</p>',
           'body_scan_ready', true,
           '["member_name","branch_name","weight","bmi","body_fat","health_score","report_url"]'::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE branch_id = b.id AND trigger_event = 'body_scan_ready' AND type = 'email');

    INSERT INTO public.templates (branch_id, name, type, content, trigger_event, is_active, variables)
    SELECT b.id, 'Body Scan Ready (WhatsApp)', 'whatsapp',
           'Hi {{member_name}}, your body scan from {{branch_name}} is ready. Weight {{weight}} kg · BMI {{bmi}} · Body Fat {{body_fat}}% · Health Score {{health_score}}. Report: {{report_url}}',
           'body_scan_ready', true,
           '["member_name","branch_name","weight","bmi","body_fat","health_score","report_url"]'::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE branch_id = b.id AND trigger_event = 'body_scan_ready' AND type = 'whatsapp');

    INSERT INTO public.templates (branch_id, name, type, content, trigger_event, is_active, variables)
    SELECT b.id, 'Body Scan Ready (SMS)', 'sms',
           'Hi {{member_name}}, your body scan from {{branch_name}} is ready. View: {{report_url}}',
           'body_scan_ready', true,
           '["member_name","branch_name","report_url"]'::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE branch_id = b.id AND trigger_event = 'body_scan_ready' AND type = 'sms');

    -- POSTURE SCAN READY (member-facing) --------------------------------
    INSERT INTO public.templates (branch_id, name, type, subject, content, trigger_event, is_active, variables)
    SELECT b.id, 'Posture Scan Ready (Email)', 'email',
           'Your Posture Scan Report — {{branch_name}}',
           '<h2>Hi {{member_name}},</h2><p>Your posture analysis from <strong>{{branch_name}}</strong> is ready.</p><ul><li>Posture Score: {{posture_score}}</li><li>Body Slope: {{body_slope}}</li></ul><p><a href="{{report_url}}">Download Full Report (PDF)</a></p>',
           'posture_scan_ready', true,
           '["member_name","branch_name","posture_score","body_slope","report_url"]'::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE branch_id = b.id AND trigger_event = 'posture_scan_ready' AND type = 'email');

    INSERT INTO public.templates (branch_id, name, type, content, trigger_event, is_active, variables)
    SELECT b.id, 'Posture Scan Ready (WhatsApp)', 'whatsapp',
           'Hi {{member_name}}, your posture scan from {{branch_name}} is ready. Score {{posture_score}} · Body Slope {{body_slope}}. Report: {{report_url}}',
           'posture_scan_ready', true,
           '["member_name","branch_name","posture_score","body_slope","report_url"]'::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE branch_id = b.id AND trigger_event = 'posture_scan_ready' AND type = 'whatsapp');

    INSERT INTO public.templates (branch_id, name, type, content, trigger_event, is_active, variables)
    SELECT b.id, 'Posture Scan Ready (SMS)', 'sms',
           'Hi {{member_name}}, your posture scan from {{branch_name}} is ready. View: {{report_url}}',
           'posture_scan_ready', true,
           '["member_name","branch_name","report_url"]'::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE branch_id = b.id AND trigger_event = 'posture_scan_ready' AND type = 'sms');

    -- SCAN READY INTERNAL (trainer / managers / admins) -----------------
    INSERT INTO public.templates (branch_id, name, type, subject, content, trigger_event, is_active, variables)
    SELECT b.id, 'Scan Ready — Staff Alert (Email)', 'email',
           'New {{scan_type}} Scan: {{member_name}} — {{branch_name}}',
           '<p>{{member_name}} ({{member_code}}) at {{branch_name}} just completed a {{scan_type}} scan.</p><p>{{summary}}</p><p><a href="{{report_url}}">Open report</a></p>',
           'scan_ready_internal', true,
           '["member_name","member_code","branch_name","scan_type","summary","report_url"]'::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE branch_id = b.id AND trigger_event = 'scan_ready_internal' AND type = 'email');

    INSERT INTO public.templates (branch_id, name, type, content, trigger_event, is_active, variables)
    SELECT b.id, 'Scan Ready — Staff Alert (WhatsApp)', 'whatsapp',
           'New {{scan_type}} scan: {{member_name}} ({{member_code}}) at {{branch_name}}. {{summary}} — {{report_url}}',
           'scan_ready_internal', true,
           '["member_name","member_code","branch_name","scan_type","summary","report_url"]'::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE branch_id = b.id AND trigger_event = 'scan_ready_internal' AND type = 'whatsapp');

  END LOOP;
END $$;

-- ============================================================
-- 2. Unified template-status view for the UI tabs
-- ============================================================
CREATE OR REPLACE VIEW public.v_template_with_meta_status AS
SELECT
  t.id,
  t.branch_id,
  t.name,
  t.type,
  t.subject,
  t.content,
  t.trigger_event,
  t.is_active,
  t.created_at,
  t.updated_at,
  t.meta_template_name,
  t.meta_template_status,
  t.meta_rejection_reason,
  -- normalized approval status used by the UI
  CASE
    WHEN t.type <> 'whatsapp' THEN 'not_applicable'
    WHEN wt.status = 'APPROVED' THEN 'approved'
    WHEN wt.status = 'PENDING'  THEN 'pending'
    WHEN wt.status = 'REJECTED' THEN 'rejected'
    WHEN wt.status IN ('PAUSED','DISABLED') THEN 'paused'
    WHEN t.meta_template_name IS NULL THEN 'draft'
    WHEN UPPER(COALESCE(t.meta_template_status,'')) = 'APPROVED' THEN 'approved'
    WHEN UPPER(COALESCE(t.meta_template_status,'')) = 'PENDING'  THEN 'pending'
    WHEN UPPER(COALESCE(t.meta_template_status,'')) = 'REJECTED' THEN 'rejected'
    ELSE 'pending'
  END AS approval_status,
  wt.id   AS whatsapp_template_id,
  wt.status AS whatsapp_meta_status,
  wt.rejected_reason AS whatsapp_rejected_reason,
  wt.language AS whatsapp_language,
  wt.category AS whatsapp_category
FROM public.templates t
LEFT JOIN public.whatsapp_templates wt
  ON wt.branch_id = t.branch_id
 AND lower(wt.name) = lower(coalesce(t.meta_template_name, ''));

GRANT SELECT ON public.v_template_with_meta_status TO authenticated;

-- ============================================================
-- 3. Index for live communication feed
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_communication_logs_branch_sent
  ON public.communication_logs (branch_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_communication_logs_status
  ON public.communication_logs (status, sent_at DESC);

-- ============================================================
-- 4. Realtime publication
-- ============================================================
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_logs';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_delivery_events';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_retry_queue';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.communication_logs REPLICA IDENTITY FULL;
ALTER TABLE public.communication_delivery_events REPLICA IDENTITY FULL;
ALTER TABLE public.communication_retry_queue REPLICA IDENTITY FULL;
