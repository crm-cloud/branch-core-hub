
-- Create whatsapp_chat_settings table for per-contact bot toggle
CREATE TABLE public.whatsapp_chat_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  bot_active boolean DEFAULT true,
  paused_at timestamptz,
  paused_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(branch_id, phone_number)
);

-- Enable RLS
ALTER TABLE public.whatsapp_chat_settings ENABLE ROW LEVEL SECURITY;

-- Staff can view chat settings
CREATE POLICY "Staff can view chat settings"
  ON public.whatsapp_chat_settings FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer']::app_role[])
  );

-- Staff can insert chat settings
CREATE POLICY "Staff can insert chat settings"
  ON public.whatsapp_chat_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer']::app_role[])
  );

-- Staff can update chat settings
CREATE POLICY "Staff can update chat settings"
  ON public.whatsapp_chat_settings FOR UPDATE
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer']::app_role[])
  );

-- Add updated_at trigger
CREATE TRIGGER update_whatsapp_chat_settings_updated_at
  BEFORE UPDATE ON public.whatsapp_chat_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
