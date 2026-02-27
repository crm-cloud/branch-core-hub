
-- 1. Add unique constraint on referral_settings.branch_id for upsert
CREATE UNIQUE INDEX IF NOT EXISTS referral_settings_branch_id_unique ON public.referral_settings(branch_id);

-- 2. Create notification triggers for key gym events
CREATE OR REPLACE FUNCTION public.notify_locker_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  member_name TEXT;
  locker_num TEXT;
BEGIN
  SELECT p.full_name INTO member_name FROM members m JOIN profiles p ON p.id = m.user_id WHERE m.id = NEW.member_id;
  SELECT locker_number INTO locker_num FROM lockers WHERE id = NEW.locker_id;
  
  INSERT INTO notifications (user_id, title, message, type, category)
  SELECT ur.user_id, 'Locker Assigned',
    'Locker #' || COALESCE(locker_num, '?') || ' assigned to ' || COALESCE(member_name, 'a member'),
    'info', 'locker'
  FROM user_roles ur WHERE ur.role IN ('owner', 'admin');
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_lead_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO notifications (user_id, branch_id, title, message, type, category)
  SELECT ur.user_id, NEW.branch_id,
    'New Lead Captured',
    'New lead: ' || COALESCE(NEW.full_name, 'Unknown') || ' (' || COALESCE(NEW.source, 'Direct') || ')',
    'info', 'lead'
  FROM user_roles ur WHERE ur.role IN ('owner', 'admin', 'manager');
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_membership_expiring()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  member_name TEXT;
  days_left INT;
BEGIN
  IF NEW.status = 'active' AND NEW.end_date IS NOT NULL THEN
    days_left := NEW.end_date - CURRENT_DATE;
    IF days_left IN (7, 3, 1) THEN
      SELECT p.full_name INTO member_name FROM members m JOIN profiles p ON p.id = m.user_id WHERE m.id = NEW.member_id;
      
      INSERT INTO notifications (user_id, branch_id, title, message, type, category)
      SELECT m.user_id, NEW.branch_id,
        'Membership Expiring Soon',
        'Your membership expires in ' || days_left || ' day(s). Please renew to continue.',
        'warning', 'membership'
      FROM members m WHERE m.id = NEW.member_id AND m.user_id IS NOT NULL;
      
      INSERT INTO notifications (user_id, branch_id, title, message, type, category)
      SELECT ur.user_id, NEW.branch_id,
        'Member Expiring',
        COALESCE(member_name, 'A member') || '''s membership expires in ' || days_left || ' day(s)',
        'warning', 'membership'
      FROM user_roles ur WHERE ur.role IN ('owner', 'admin');
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_referral_converted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  referrer_user_id UUID;
  referee_name TEXT;
  v_reward_type TEXT;
  v_reward_value NUMERIC;
BEGIN
  IF NEW.status = 'converted' AND (OLD.status IS DISTINCT FROM 'converted') THEN
    SELECT m.user_id INTO referrer_user_id FROM members m WHERE m.id = NEW.referrer_id;
    SELECT p.full_name INTO referee_name FROM members m JOIN profiles p ON p.id = m.user_id WHERE m.id = NEW.referee_id;
    
    SELECT rs.reward_type, rs.reward_value INTO v_reward_type, v_reward_value
    FROM referral_settings rs WHERE rs.branch_id = NEW.branch_id LIMIT 1;
    
    IF v_reward_type IS NOT NULL AND v_reward_value > 0 THEN
      INSERT INTO referral_rewards (referral_id, member_id, reward_type, reward_value, status)
      VALUES (NEW.id, NEW.referrer_id, v_reward_type, v_reward_value, 'pending');
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
END; $$;

-- Create triggers
DROP TRIGGER IF EXISTS trg_notify_locker_assigned ON locker_assignments;
CREATE TRIGGER trg_notify_locker_assigned AFTER INSERT ON locker_assignments FOR EACH ROW EXECUTE FUNCTION notify_locker_assigned();

DROP TRIGGER IF EXISTS trg_notify_lead_created ON leads;
CREATE TRIGGER trg_notify_lead_created AFTER INSERT ON leads FOR EACH ROW EXECUTE FUNCTION notify_lead_created();

DROP TRIGGER IF EXISTS trg_notify_membership_expiring ON memberships;
CREATE TRIGGER trg_notify_membership_expiring AFTER UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION notify_membership_expiring();

DROP TRIGGER IF EXISTS trg_notify_referral_converted ON referrals;
CREATE TRIGGER trg_notify_referral_converted AFTER UPDATE ON referrals FOR EACH ROW EXECUTE FUNCTION notify_referral_converted();
