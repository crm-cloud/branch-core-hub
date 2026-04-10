-- Epic 3 & 5: Track AI lead capture state per WhatsApp contact
ALTER TABLE public.whatsapp_chat_settings
  ADD COLUMN IF NOT EXISTS lead_captured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS captured_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

-- Index for quick lead lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_settings_lead
  ON public.whatsapp_chat_settings(captured_lead_id)
  WHERE captured_lead_id IS NOT NULL;
