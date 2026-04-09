-- Epic 2: whatsapp_templates table
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  waba_id text NOT NULL,
  meta_template_id text,
  name text NOT NULL,
  language text DEFAULT 'en',
  category text,
  status text DEFAULT 'PENDING',
  quality_score text,
  rejected_reason text,
  components jsonb,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view whatsapp templates"
  ON public.whatsapp_templates FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

CREATE POLICY "Staff can insert whatsapp templates"
  ON public.whatsapp_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

CREATE POLICY "Staff can update whatsapp templates"
  ON public.whatsapp_templates FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

CREATE POLICY "Staff can delete whatsapp templates"
  ON public.whatsapp_templates FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

CREATE INDEX idx_whatsapp_templates_branch ON public.whatsapp_templates(branch_id);
CREATE INDEX idx_whatsapp_templates_waba ON public.whatsapp_templates(waba_id);
CREATE UNIQUE INDEX idx_whatsapp_templates_unique ON public.whatsapp_templates(waba_id, name, language);

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_templates;

-- Epic 5: AI config column on organization_settings
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS whatsapp_ai_config jsonb DEFAULT '{}'::jsonb;