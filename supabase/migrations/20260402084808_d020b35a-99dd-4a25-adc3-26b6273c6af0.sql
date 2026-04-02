
-- Fix org settings RLS: add manager role
DROP POLICY IF EXISTS "Admin can manage org settings" ON public.organization_settings;
CREATE POLICY "Admin can manage org settings"
ON public.organization_settings
FOR ALL
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]));

-- Contract templates table
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL,
  template_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role)
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff+ can view contract templates"
ON public.contract_templates
FOR SELECT
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

CREATE POLICY "Admin can manage contract templates"
ON public.contract_templates
FOR ALL
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

-- SMS logs table
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message_id TEXT,
  provider TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id),
  sent_by UUID,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff+ can view sms logs"
ON public.sms_logs
FOR SELECT
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

CREATE POLICY "Staff+ can insert sms logs"
ON public.sms_logs
FOR INSERT
TO authenticated
WITH CHECK (has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));
