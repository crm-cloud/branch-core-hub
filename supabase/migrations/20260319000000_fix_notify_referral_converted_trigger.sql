-- Fix notify_referral_converted trigger: remove NEW.branch_id access (referrals table has no branch_id column).
-- The frontend already handles referral_rewards insertion, so the trigger only sends the notification.
CREATE OR REPLACE FUNCTION public.notify_referral_converted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  referrer_user_id UUID;
  referee_name TEXT;
  v_branch_id UUID;
BEGIN
  IF NEW.status = 'converted' AND (OLD.status IS DISTINCT FROM 'converted') THEN
    -- Resolve branch_id from the referrer's member record (referrals table has no branch_id column)
    SELECT m.branch_id INTO v_branch_id
      FROM members m
     WHERE m.id = NEW.referrer_member_id;

    SELECT m.user_id INTO referrer_user_id
      FROM members m
     WHERE m.id = NEW.referrer_member_id;

    SELECT p.full_name INTO referee_name
      FROM members m
      JOIN profiles p ON p.id = m.user_id
     WHERE m.id = NEW.referred_member_id;

    -- Send notification to referrer
    IF referrer_user_id IS NOT NULL AND v_branch_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, branch_id, title, message, type, category)
      VALUES (
        referrer_user_id,
        v_branch_id,
        'Referral Converted!',
        COALESCE(referee_name, 'Your referral') || ' has joined! Your reward is being processed.',
        'success',
        'referral'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
