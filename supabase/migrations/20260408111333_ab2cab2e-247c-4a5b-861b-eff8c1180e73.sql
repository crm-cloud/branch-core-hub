-- Lead notification rules table
CREATE TABLE public.lead_notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  sms_to_lead boolean NOT NULL DEFAULT false,
  whatsapp_to_lead boolean NOT NULL DEFAULT false,
  sms_to_admins boolean NOT NULL DEFAULT false,
  whatsapp_to_admins boolean NOT NULL DEFAULT false,
  sms_to_managers boolean NOT NULL DEFAULT false,
  whatsapp_to_managers boolean NOT NULL DEFAULT false,
  lead_welcome_sms text NOT NULL DEFAULT 'Hi {{lead_name}}, thank you for your interest in {{branch_name}}! We will contact you shortly.',
  lead_welcome_whatsapp text NOT NULL DEFAULT 'Hi {{lead_name}}, welcome to {{branch_name}}! 🏋️ Our team will reach out to you soon.',
  team_alert_sms text NOT NULL DEFAULT 'New lead: {{lead_name}} ({{lead_phone}}) from {{lead_source}} at {{branch_name}}',
  team_alert_whatsapp text NOT NULL DEFAULT '🔔 New Lead Alert\nName: {{lead_name}}\nPhone: {{lead_phone}}\nSource: {{lead_source}}\nBranch: {{branch_name}}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_branch_notification_rules UNIQUE (branch_id)
);

-- Allow null branch_id for global default (only one null allowed)
CREATE UNIQUE INDEX idx_lead_notification_rules_global ON public.lead_notification_rules ((branch_id IS NULL)) WHERE branch_id IS NULL;

-- Enable RLS
ALTER TABLE public.lead_notification_rules ENABLE ROW LEVEL SECURITY;

-- Policies: only staff-level roles can manage
CREATE POLICY "Staff can view lead notification rules"
  ON public.lead_notification_rules FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]));

CREATE POLICY "Staff can insert lead notification rules"
  ON public.lead_notification_rules FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]));

CREATE POLICY "Staff can update lead notification rules"
  ON public.lead_notification_rules FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]));

CREATE POLICY "Staff can delete lead notification rules"
  ON public.lead_notification_rules FOR DELETE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

-- Auto-update updated_at
CREATE TRIGGER update_lead_notification_rules_updated_at
  BEFORE UPDATE ON public.lead_notification_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();