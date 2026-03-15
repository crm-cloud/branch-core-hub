
-- Add channels array to retention_templates
ALTER TABLE public.retention_templates 
  ADD COLUMN IF NOT EXISTS channels text[] DEFAULT '{whatsapp}';

-- Add message_content to retention_nudge_logs
ALTER TABLE public.retention_nudge_logs
  ADD COLUMN IF NOT EXISTS message_content text;
