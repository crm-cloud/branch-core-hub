
DROP VIEW IF EXISTS public.v_template_with_meta_status;

CREATE VIEW public.v_template_with_meta_status AS
SELECT t.id,
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
       CASE
         WHEN t.type <> 'whatsapp' THEN 'not_applicable'
         WHEN wt.status = 'APPROVED' THEN 'approved'
         WHEN wt.status = 'PENDING' THEN 'pending'
         WHEN wt.status = 'REJECTED' THEN 'rejected'
         WHEN wt.status = ANY (ARRAY['PAUSED','DISABLED']) THEN 'paused'
         WHEN t.meta_template_name IS NULL THEN 'draft'
         WHEN upper(COALESCE(t.meta_template_status,'')) = 'APPROVED' THEN 'approved'
         WHEN upper(COALESCE(t.meta_template_status,'')) = 'PENDING' THEN 'pending'
         WHEN upper(COALESCE(t.meta_template_status,'')) = 'REJECTED' THEN 'rejected'
         ELSE 'pending'
       END AS approval_status,
       wt.id   AS whatsapp_template_id,
       wt.status AS whatsapp_meta_status,
       wt.rejected_reason AS whatsapp_rejected_reason,
       wt.language AS whatsapp_language,
       wt.category AS whatsapp_category,
       t.header_type,
       t.header_media_url,
       t.header_media_handle,
       t.attachment_source,
       t.attachment_filename_template
FROM public.templates t
LEFT JOIN public.whatsapp_templates wt
  ON wt.branch_id = t.branch_id
 AND lower(wt.name) = lower(COALESCE(t.meta_template_name, ''));

WITH ranked AS (
  SELECT id, branch_id, name, type,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(branch_id::text,'GLOBAL'), name, type
           ORDER BY updated_at DESC, created_at DESC
         ) AS rn
  FROM public.templates
),
survivors AS (
  SELECT branch_id, name, type, id AS survivor_id FROM ranked WHERE rn = 1
),
losers AS (
  SELECT r.id AS loser_id, s.survivor_id
  FROM ranked r
  JOIN survivors s
    ON COALESCE(r.branch_id::text,'GLOBAL') = COALESCE(s.branch_id::text,'GLOBAL')
   AND r.name = s.name AND r.type = s.type
  WHERE r.rn > 1
)
UPDATE public.whatsapp_triggers wt
SET template_id = l.survivor_id
FROM losers l
WHERE wt.template_id = l.loser_id;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(branch_id::text,'GLOBAL'), name, type
           ORDER BY updated_at DESC, created_at DESC
         ) AS rn
  FROM public.templates
)
DELETE FROM public.templates t USING ranked r
WHERE t.id = r.id AND r.rn > 1;

UPDATE public.templates
SET meta_template_status = 'pending'
WHERE name LIKE '%\_doc' ESCAPE '\'
  AND lower(COALESCE(meta_template_status,'')) = 'draft';

INSERT INTO public.templates
  (branch_id, name, type, content, header_type, attachment_source,
   attachment_filename_template, meta_template_name, meta_template_status,
   trigger_event, is_active, variables)
SELECT NULL, v.name, 'whatsapp', v.content, 'document', 'dynamic',
       v.filename_tpl, v.name, 'pending', v.event, true, v.vars::jsonb
FROM (VALUES
  ('workout_plan_ready_doc',
   'Hi {{member_name}}, your personalised workout plan *{{plan_name}}* is ready. Please find it attached.',
   'workout_{{member_code}}.pdf', 'workout_plan_ready',
   '["member_name","plan_name","member_code"]'),
  ('diet_plan_ready_doc',
   'Hi {{member_name}}, your personalised diet plan *{{plan_name}}* is ready. Please find it attached.',
   'diet_{{member_code}}.pdf', 'diet_plan_ready',
   '["member_name","plan_name","member_code"]'),
  ('payment_receipt_doc',
   'Hi {{member_name}}, thanks for your payment of ₹{{amount}}. Your receipt {{invoice_number}} is attached.',
   'receipt_{{invoice_number}}.pdf', 'payment_received',
   '["member_name","amount","invoice_number"]'),
  ('scan_report_doc',
   'Hi {{member_name}}, your latest body scan report is attached. Reach out to your trainer for a walkthrough.',
   'scan_{{member_code}}.pdf', 'scan_report_ready',
   '["member_name","member_code"]'),
  ('invoice_ready_doc',
   'Hi {{member_name}}, please find your invoice {{invoice_number}} for ₹{{amount}} attached.',
   'invoice_{{invoice_number}}.pdf', 'invoice_generated',
   '["member_name","invoice_number","amount"]'),
  ('pos_receipt_doc',
   'Hi {{member_name}}, thanks for your purchase at our in-house store. Your receipt is attached.',
   'pos_{{invoice_number}}.pdf', 'pos_purchase_receipt',
   '["member_name","invoice_number"]')
) AS v(name, content, filename_tpl, event, vars)
WHERE NOT EXISTS (
  SELECT 1 FROM public.templates t
  WHERE t.name = v.name AND t.branch_id IS NULL AND t.type = 'whatsapp'
);
