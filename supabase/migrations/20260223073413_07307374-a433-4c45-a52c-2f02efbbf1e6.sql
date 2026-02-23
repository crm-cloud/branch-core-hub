
-- Enable required extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Auto-expire memberships function (runs daily)
CREATE OR REPLACE FUNCTION public.auto_expire_memberships()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE memberships 
  SET status = 'expired'
  WHERE status = 'active'
    AND end_date < CURRENT_DATE
  RETURNING COUNT(*) INTO v_count;
  
  -- Log the auto-expiry
  IF v_count > 0 THEN
    INSERT INTO audit_logs (action, table_name, user_id, actor_name, action_description)
    VALUES ('AUTO_EXPIRE', 'memberships', NULL, 'System', 
            'Auto-expired ' || v_count || ' membership(s) past end_date');
  END IF;
END;
$$;

-- Enable realtime for whatsapp_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
