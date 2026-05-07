ALTER TABLE public.whatsapp_messages
ADD COLUMN IF NOT EXISTS contact_avatar_url text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone_avatar
  ON public.whatsapp_messages (phone_number)
  WHERE contact_avatar_url IS NOT NULL;