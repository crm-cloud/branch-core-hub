
-- 1) Deactivate the legacy plan templates that can never be approved by Meta
--    (they use header_type='document' with no uploaded media handle).
UPDATE public.templates
   SET is_active = false,
       updated_at = now()
 WHERE type = 'whatsapp'
   AND meta_template_name IS NULL
   AND header_type = 'document'
   AND trigger_event IN (
     'workout_plan_ready',
     'diet_plan_ready',
     'plan_assigned_workout',
     'plan_assigned_diet',
     'body_scan_ready',
     'posture_scan_ready',
     'invoice_ready',
     'payment_received',
     'pos_receipt_ready',
     'scan_report_ready'
   );

-- 2) Seed canonical document-link templates (global, branch_id NULL).
--    header_type='none' + {{document_link}} body var is the only Meta-approvable
--    pattern for dynamic PDFs. Owner submits each from the Templates Hub.

INSERT INTO public.templates
  (branch_id, name, type, content, variables, header_type, attachment_source,
   trigger_event, meta_template_status, is_active)
VALUES
  (NULL,
   'workout_plan_ready_link',
   'whatsapp',
   E'Hi {{member_name}}, your new workout plan *{{plan_name}}* from {{trainer_name}} is ready.\n\nDownload it here: {{document_link}}\n\nLet''s crush your goals! — Team Incline',
   '["member_name","plan_name","trainer_name","document_link"]'::jsonb,
   'none',
   'dynamic',
   'workout_plan_ready',
   'pending',
   true),
  (NULL,
   'diet_plan_ready_link',
   'whatsapp',
   E'Hi {{member_name}}, your personalised diet plan *{{plan_name}}* from {{trainer_name}} is here.\n\nDownload it here: {{document_link}}\n\nFuel your fitness journey! — Team Incline',
   '["member_name","plan_name","trainer_name","document_link"]'::jsonb,
   'none',
   'dynamic',
   'diet_plan_ready',
   'pending',
   true),
  (NULL,
   'payment_receipt_link',
   'whatsapp',
   E'Hi {{member_name}}, we have received your payment of ₹{{amount}} against invoice *{{invoice_number}}*.\n\nYour receipt: {{document_link}}\n\nThank you! — Team Incline',
   '["member_name","amount","invoice_number","document_link"]'::jsonb,
   'none',
   'dynamic',
   'payment_received',
   'pending',
   true),
  (NULL,
   'scan_report_link',
   'whatsapp',
   E'Hi {{member_name}}, your latest body scan report from {{branch_name}} is ready.\n\nView it here: {{document_link}}\n\n— Team Incline',
   '["member_name","branch_name","document_link"]'::jsonb,
   'none',
   'dynamic',
   'scan_report_ready',
   'pending',
   true);
