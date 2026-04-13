
-- Create messaging platform enum (skip if already exists from failed migration)
DO $$ BEGIN
  CREATE TYPE public.messaging_platform AS ENUM ('whatsapp', 'instagram', 'messenger');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add platform column to whatsapp_messages
ALTER TABLE public.whatsapp_messages 
  ADD COLUMN IF NOT EXISTS platform messaging_platform NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS platform_message_id text;

-- Add platform column to whatsapp_chat_settings
ALTER TABLE public.whatsapp_chat_settings 
  ADD COLUMN IF NOT EXISTS platform messaging_platform NOT NULL DEFAULT 'whatsapp';

-- Create indexes for platform filtering
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_platform ON public.whatsapp_messages(platform);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_settings_platform ON public.whatsapp_chat_settings(platform);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_platform_msg_id ON public.whatsapp_messages(platform_message_id) WHERE platform_message_id IS NOT NULL;

-- Create unified CRM views
CREATE OR REPLACE VIEW public.crm_messages AS
SELECT 
  id, branch_id, phone_number, contact_name, member_id,
  content, direction, status, message_type,
  platform, platform_message_id,
  whatsapp_message_id,
  created_at, updated_at
FROM public.whatsapp_messages;
