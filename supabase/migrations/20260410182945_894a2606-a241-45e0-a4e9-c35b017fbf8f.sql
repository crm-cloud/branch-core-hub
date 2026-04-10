ALTER TABLE public.whatsapp_chat_settings ADD COLUMN IF NOT EXISTS is_unread boolean DEFAULT true;

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chat_settings;