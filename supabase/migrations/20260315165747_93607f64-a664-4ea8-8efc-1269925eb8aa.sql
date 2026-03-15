
-- Drop and recreate get_inactive_members with avatar_url in return type
DROP FUNCTION IF EXISTS public.get_inactive_members(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_inactive_members(p_branch_id uuid, p_days integer DEFAULT 7, p_limit integer DEFAULT 50)
 RETURNS TABLE(member_id uuid, member_code text, full_name text, phone text, email text, avatar_url text, last_visit timestamp with time zone, days_absent integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id AS member_id,
    m.member_code,
    COALESCE(p.full_name, 'Unknown') AS full_name,
    p.phone,
    p.email,
    p.avatar_url,
    ma.last_check_in AS last_visit,
    EXTRACT(DAY FROM (now() - ma.last_check_in))::integer AS days_absent
  FROM members m
  JOIN profiles p ON p.id = m.user_id
  JOIN memberships ms ON ms.member_id = m.id AND ms.status = 'active' AND ms.end_date >= CURRENT_DATE
  LEFT JOIN LATERAL (
    SELECT MAX(check_in) AS last_check_in
    FROM member_attendance att
    WHERE att.member_id = m.id
  ) ma ON true
  WHERE m.branch_id = p_branch_id
    AND (ma.last_check_in IS NULL OR ma.last_check_in < now() - (p_days || ' days')::interval)
  ORDER BY ma.last_check_in ASC NULLS FIRST
  LIMIT p_limit;
END;
$$;

-- Fix notify_referral_converted trigger to resolve branch_id from referrer
CREATE OR REPLACE FUNCTION public.notify_referral_converted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  referrer_user_id UUID;
  referee_name TEXT;
  v_reward_type TEXT;
  v_reward_value NUMERIC;
  v_branch_id UUID;
BEGIN
  IF NEW.status = 'converted' AND (OLD.status IS DISTINCT FROM 'converted') THEN
    v_branch_id := NEW.branch_id;
    IF v_branch_id IS NULL THEN
      SELECT m.branch_id INTO v_branch_id FROM members m WHERE m.id = NEW.referrer_member_id;
    END IF;

    SELECT m.user_id INTO referrer_user_id FROM members m WHERE m.id = NEW.referrer_member_id;
    SELECT p.full_name INTO referee_name FROM members m JOIN profiles p ON p.id = m.user_id WHERE m.id = NEW.referred_member_id;
    
    IF v_branch_id IS NOT NULL THEN
      SELECT rs.referrer_reward_type, rs.referrer_reward_value INTO v_reward_type, v_reward_value
      FROM referral_settings rs WHERE rs.branch_id = v_branch_id AND rs.is_active = true LIMIT 1;
      
      IF v_reward_type IS NOT NULL AND v_reward_value > 0 THEN
        INSERT INTO referral_rewards (referral_id, member_id, reward_type, reward_value)
        VALUES (NEW.id, NEW.referrer_member_id, v_reward_type, v_reward_value);
      END IF;
    END IF;
    
    IF referrer_user_id IS NOT NULL AND v_branch_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, branch_id, title, message, type, category)
      VALUES (referrer_user_id, v_branch_id,
        'Referral Converted!',
        COALESCE(referee_name, 'Your referral') || ' has joined! Your reward is being processed.',
        'success', 'referral');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
