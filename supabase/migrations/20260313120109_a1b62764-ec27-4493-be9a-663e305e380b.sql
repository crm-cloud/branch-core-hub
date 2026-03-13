
-- Fix 1: Referral trigger - wrong column names and non-existent 'status' column
CREATE OR REPLACE FUNCTION public.notify_referral_converted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  referrer_user_id UUID;
  referee_name TEXT;
  v_reward_type TEXT;
  v_reward_value NUMERIC;
BEGIN
  IF NEW.status = 'converted' AND (OLD.status IS DISTINCT FROM 'converted') THEN
    SELECT m.user_id INTO referrer_user_id FROM members m WHERE m.id = NEW.referrer_id;
    SELECT p.full_name INTO referee_name FROM members m JOIN profiles p ON p.id = m.user_id WHERE m.id = NEW.referee_id;
    
    SELECT rs.referrer_reward_type, rs.referrer_reward_value INTO v_reward_type, v_reward_value
    FROM referral_settings rs WHERE rs.branch_id = NEW.branch_id AND rs.is_active = true LIMIT 1;
    
    IF v_reward_type IS NOT NULL AND v_reward_value > 0 THEN
      INSERT INTO referral_rewards (referral_id, member_id, reward_type, reward_value)
      VALUES (NEW.id, NEW.referrer_id, v_reward_type, v_reward_value);
    END IF;
    
    IF referrer_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, branch_id, title, message, type, category)
      VALUES (referrer_user_id, NEW.branch_id,
        'Referral Converted!',
        COALESCE(referee_name, 'Your referral') || ' has joined! Your reward is being processed.',
        'success', 'referral');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix 2: Add proper UNIQUE constraints for biometric_sync_queue
DROP INDEX IF EXISTS biometric_sync_queue_member_device_idx;
DROP INDEX IF EXISTS biometric_sync_queue_staff_device_idx;

ALTER TABLE public.biometric_sync_queue
  ADD CONSTRAINT biometric_sync_queue_member_device_unique UNIQUE (member_id, device_id);

ALTER TABLE public.biometric_sync_queue
  ADD CONSTRAINT biometric_sync_queue_staff_device_unique UNIQUE (staff_id, device_id);
