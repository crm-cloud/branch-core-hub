-- Create whatsapp_chats table for per-contact chat state (bot_active, lead_captured)
CREATE TABLE IF NOT EXISTS public.whatsapp_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  bot_active BOOLEAN NOT NULL DEFAULT true,
  lead_captured BOOLEAN NOT NULL DEFAULT false,
  captured_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_chats_branch_phone_unique UNIQUE (branch_id, phone_number)
);

ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;

-- Staff and above can view/manage chats for their branches
CREATE POLICY "Staff can manage whatsapp chats"
  ON public.whatsapp_chats
  FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

-- Keep updated_at current
CREATE OR REPLACE FUNCTION public.set_whatsapp_chats_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER whatsapp_chats_updated_at
  BEFORE UPDATE ON public.whatsapp_chats
  FOR EACH ROW EXECUTE FUNCTION public.set_whatsapp_chats_updated_at();
