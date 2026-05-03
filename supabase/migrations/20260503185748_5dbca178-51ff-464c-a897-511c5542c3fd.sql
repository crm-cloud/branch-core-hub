ALTER PUBLICATION supabase_realtime ADD TABLE public.templates;
ALTER TABLE public.templates REPLICA IDENTITY FULL;
CREATE UNIQUE INDEX IF NOT EXISTS templates_meta_name_unique
  ON public.templates (type, meta_template_name)
  WHERE meta_template_name IS NOT NULL;