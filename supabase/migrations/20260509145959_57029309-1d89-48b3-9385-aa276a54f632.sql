-- Re-activate Meta-linked rows, force header_type='none' so dispatcher won't try HEADER injection
UPDATE public.templates
SET is_active = true, header_type = 'none', attachment_source = 'none', updated_at = now()
WHERE name IN ('workout_plan_ready_doc','diet_plan_ready_doc')
  AND type = 'whatsapp';

-- Deactivate the link rows that have no meta_template_name (would fall to freeform → 131047)
UPDATE public.templates
SET is_active = false, updated_at = now()
WHERE name IN ('workout_plan_ready_link','diet_plan_ready_link')
  AND type = 'whatsapp'
  AND meta_template_name IS NULL;