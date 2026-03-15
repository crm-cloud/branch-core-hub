
-- Retention Templates table
CREATE TABLE public.retention_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  stage_level integer NOT NULL,
  stage_name text NOT NULL,
  days_trigger integer NOT NULL,
  message_body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Retention Nudge Logs table
CREATE TABLE public.retention_nudge_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.retention_templates(id) ON DELETE SET NULL,
  stage_level integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL DEFAULT 'whatsapp',
  status text NOT NULL DEFAULT 'sent',
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.retention_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_nudge_logs ENABLE ROW LEVEL SECURITY;

-- RLS: retention_templates - authenticated staff/admin/owner can read
CREATE POLICY "Staff and above can view retention templates"
  ON public.retention_templates FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

-- RLS: retention_templates - admin/owner can modify
CREATE POLICY "Admins can manage retention templates"
  ON public.retention_templates FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

-- RLS: retention_nudge_logs - staff and above can read
CREATE POLICY "Staff and above can view nudge logs"
  ON public.retention_nudge_logs FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

-- RLS: retention_nudge_logs - staff and above can insert/update
CREATE POLICY "Staff and above can manage nudge logs"
  ON public.retention_nudge_logs FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

-- Updated_at trigger
CREATE TRIGGER update_retention_templates_updated_at
  BEFORE UPDATE ON public.retention_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

NOTIFY pgrst, 'reload schema';
