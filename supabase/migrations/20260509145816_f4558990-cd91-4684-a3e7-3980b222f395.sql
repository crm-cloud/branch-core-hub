UPDATE public.templates
SET is_active = false, updated_at = now()
WHERE type = 'whatsapp'
  AND header_type = 'document'
  AND trigger_event IN (
    'workout_plan_ready','diet_plan_ready',
    'invoice_generated','payment_received','pos_invoice','body_scan_ready','posture_scan_ready'
  )
  AND name IN ('custom_workout_plan_ready_pdf','custom_diet_plan_ready_pdf','workout_plan_ready_doc','diet_plan_ready_doc');