UPDATE public.templates
SET variables = '["member_name","plan_title"]'::jsonb,
    header_type = 'document',
    attachment_source = 'dynamic',
    is_active = true,
    updated_at = now()
WHERE meta_template_name IN ('workout_plan_ready_doc','diet_plan_ready_doc');