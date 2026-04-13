
-- Fix security definer view
CREATE OR REPLACE VIEW public.crm_messages 
WITH (security_invoker = true)
AS
SELECT 
  id, branch_id, phone_number, contact_name, member_id,
  content, direction, status, message_type,
  platform, platform_message_id,
  whatsapp_message_id,
  created_at, updated_at
FROM public.whatsapp_messages;
