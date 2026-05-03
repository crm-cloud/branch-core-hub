-- Seed default dynamic-PDF invoice/receipt templates per branch (idempotent).
DO $$
DECLARE
  b RECORD;
BEGIN
  FOR b IN SELECT id, name FROM public.branches LOOP

    -- Invoice PDF — WhatsApp
    IF NOT EXISTS (
      SELECT 1 FROM public.templates
      WHERE branch_id = b.id AND name = 'Invoice PDF — WhatsApp'
    ) THEN
      INSERT INTO public.templates (
        branch_id, name, type, subject, content, is_active,
        trigger_event, header_type, attachment_source,
        attachment_filename_template, variables
      ) VALUES (
        b.id,
        'Invoice PDF — WhatsApp',
        'whatsapp',
        NULL,
        E'Hi {{member_name}},\n\nYour invoice *{{invoice_number}}* for ₹{{amount}} is ready. The PDF is attached.\n\nDate: {{date}}\nBranch: {{branch_name}}\n\nThank you for choosing Incline Fitness!',
        true,
        'payment_received',
        'document',
        'dynamic',
        'Invoice-{{invoice_number}}.pdf',
        '["member_name","invoice_number","amount","date","branch_name"]'::jsonb
      );
    END IF;

    -- Invoice PDF — Email
    IF NOT EXISTS (
      SELECT 1 FROM public.templates
      WHERE branch_id = b.id AND name = 'Invoice PDF — Email'
    ) THEN
      INSERT INTO public.templates (
        branch_id, name, type, subject, content, is_active,
        trigger_event, header_type, attachment_source,
        attachment_filename_template, variables
      ) VALUES (
        b.id,
        'Invoice PDF — Email',
        'email',
        'Invoice {{invoice_number}} from {{branch_name}}',
        E'<p>Dear {{member_name}},</p>\n<p>Please find your invoice <strong>{{invoice_number}}</strong> for ₹{{amount}} attached as a PDF.</p>\n<p>Date: {{date}}<br>Branch: {{branch_name}}</p>\n<p>Thank you for choosing Incline Fitness!</p>',
        true,
        'payment_received',
        'document',
        'dynamic',
        'Invoice-{{invoice_number}}.pdf',
        '["member_name","invoice_number","amount","date","branch_name"]'::jsonb
      );
    END IF;

    -- Payment Receipt PDF — WhatsApp
    IF NOT EXISTS (
      SELECT 1 FROM public.templates
      WHERE branch_id = b.id AND name = 'Payment Receipt PDF — WhatsApp'
    ) THEN
      INSERT INTO public.templates (
        branch_id, name, type, subject, content, is_active,
        trigger_event, header_type, attachment_source,
        attachment_filename_template, variables
      ) VALUES (
        b.id,
        'Payment Receipt PDF — WhatsApp',
        'whatsapp',
        NULL,
        E'Hi {{member_name}},\n\nWe have received your payment of ₹{{amount}} against invoice *{{invoice_number}}*. Receipt attached.\n\nDate: {{date}}\nBranch: {{branch_name}}\n\nThanks!',
        true,
        'payment_received',
        'document',
        'dynamic',
        'Receipt-{{invoice_number}}.pdf',
        '["member_name","invoice_number","amount","date","branch_name"]'::jsonb
      );
    END IF;

    -- Payment Receipt PDF — Email
    IF NOT EXISTS (
      SELECT 1 FROM public.templates
      WHERE branch_id = b.id AND name = 'Payment Receipt PDF — Email'
    ) THEN
      INSERT INTO public.templates (
        branch_id, name, type, subject, content, is_active,
        trigger_event, header_type, attachment_source,
        attachment_filename_template, variables
      ) VALUES (
        b.id,
        'Payment Receipt PDF — Email',
        'email',
        'Payment receipt for invoice {{invoice_number}}',
        E'<p>Dear {{member_name}},</p>\n<p>This confirms we received your payment of <strong>₹{{amount}}</strong> for invoice <strong>{{invoice_number}}</strong>. The receipt PDF is attached.</p>\n<p>Date: {{date}}<br>Branch: {{branch_name}}</p>\n<p>Thank you!</p>',
        true,
        'payment_received',
        'document',
        'dynamic',
        'Receipt-{{invoice_number}}.pdf',
        '["member_name","invoice_number","amount","date","branch_name"]'::jsonb
      );
    END IF;

  END LOOP;
END $$;