
-- Seed *_doc WhatsApp templates with native document headers.
-- Body has NO {{document_link}} — the document is delivered natively as the header.
INSERT INTO public.templates (
  branch_id, name, type, content, variables, is_active,
  trigger_event, header_type, attachment_source, attachment_filename_template,
  meta_template_status
)
SELECT NULL, x.name, 'whatsapp', x.body, x.vars::jsonb, true,
       x.trigger_event, 'document', 'dynamic', x.filename, 'draft'
FROM (VALUES
  ('workout_plan_ready_doc',  'workout_plan_ready',
   'Hi {{member_name}}, your new workout plan ({{plan_title}}) is ready. Open the attached PDF to get started. — Team Incline',
   '["member_name","plan_title"]', 'workout_plan_{{member_code}}.pdf'),
  ('diet_plan_ready_doc',     'diet_plan_ready',
   'Hi {{member_name}}, your personalised diet plan ({{plan_title}}) is ready. Open the attached PDF to view it. — Team Incline',
   '["member_name","plan_title"]', 'diet_plan_{{member_code}}.pdf'),
  ('payment_receipt_doc',     'payment_received',
   'Hi {{member_name}}, payment of ₹{{amount}} received for {{plan_name}}. Receipt attached. — Team Incline',
   '["member_name","amount","plan_name"]', 'receipt_{{invoice_number}}.pdf'),
  ('invoice_ready_doc',       'invoice_ready',
   'Hi {{member_name}}, invoice {{invoice_number}} for ₹{{amount}} is attached. — Team Incline',
   '["member_name","invoice_number","amount"]', 'invoice_{{invoice_number}}.pdf'),
  ('pos_receipt_doc',         'pos_receipt_ready',
   'Hi {{member_name}}, your POS receipt {{receipt_number}} is attached. Thank you for your purchase. — Team Incline',
   '["member_name","receipt_number"]', 'pos_{{receipt_number}}.pdf'),
  ('scan_report_doc',         'scan_report_ready',
   'Hi {{member_name}}, your body composition scan report is attached. Discuss the results with your trainer. — Team Incline',
   '["member_name"]', 'scan_{{member_code}}.pdf')
) AS x(name, trigger_event, body, vars, filename)
ON CONFLICT DO NOTHING;
