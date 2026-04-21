-- =====================================================================
-- Phase D: Branch-scoped, deduplicated notifications + realtime chat
-- =====================================================================

-- 1) NEW LEAD: branch-scoped + DISTINCT
CREATE OR REPLACE FUNCTION public.notify_lead_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO notifications (user_id, branch_id, title, message, type, category)
  SELECT DISTINCT u_id, NEW.branch_id,
    'New Lead Captured',
    'New lead: ' || COALESCE(NEW.full_name, 'Unknown') || ' (' || COALESCE(NEW.source, 'Direct') || ')',
    'info', 'lead'
  FROM (
    SELECT ur.user_id AS u_id FROM user_roles ur WHERE ur.role IN ('owner', 'admin')
    UNION
    SELECT bm.user_id FROM branch_managers bm WHERE bm.branch_id = NEW.branch_id
    UNION
    SELECT sb.user_id FROM staff_branches sb WHERE sb.branch_id = NEW.branch_id
  ) recipients
  WHERE u_id IS NOT NULL;
  RETURN NEW;
END;
$$;

-- 2) NEW MEMBER: branch-scoped + DISTINCT, exclude the new member
CREATE OR REPLACE FUNCTION public.notify_new_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  member_name TEXT;
BEGIN
  SELECT p.full_name INTO member_name FROM profiles p WHERE p.id = NEW.user_id;

  INSERT INTO notifications (user_id, branch_id, title, message, type, category)
  SELECT DISTINCT u_id, NEW.branch_id,
    'New Member Registered',
    'New member registration: ' || COALESCE(member_name, 'Unknown'),
    'info', 'member'
  FROM (
    SELECT ur.user_id AS u_id FROM user_roles ur WHERE ur.role IN ('owner', 'admin')
    UNION
    SELECT bm.user_id FROM branch_managers bm WHERE bm.branch_id = NEW.branch_id
    UNION
    SELECT sb.user_id FROM staff_branches sb WHERE sb.branch_id = NEW.branch_id
  ) recipients
  WHERE u_id IS NOT NULL
    AND u_id <> COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid);
  RETURN NEW;
END;
$$;

-- 3) PAYMENT RECEIVED: branch-scoped + DISTINCT
CREATE OR REPLACE FUNCTION public.notify_payment_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  member_name TEXT;
BEGIN
  SELECT p.full_name INTO member_name
  FROM members m JOIN profiles p ON p.id = m.user_id
  WHERE m.id = NEW.member_id;

  INSERT INTO notifications (user_id, branch_id, title, message, type, category)
  SELECT DISTINCT u_id, NEW.branch_id,
    'Payment Received',
    'Payment of ₹' || NEW.amount || ' received from ' || COALESCE(member_name, 'a member'),
    'success', 'payment'
  FROM (
    SELECT ur.user_id AS u_id FROM user_roles ur WHERE ur.role IN ('owner', 'admin')
    UNION
    SELECT bm.user_id FROM branch_managers bm WHERE bm.branch_id = NEW.branch_id
  ) recipients
  WHERE u_id IS NOT NULL;
  RETURN NEW;
END;
$$;

-- 4) LOCKER ASSIGNED: branch-scoped + DISTINCT
CREATE OR REPLACE FUNCTION public.notify_locker_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  member_name TEXT;
  locker_num TEXT;
  v_branch_id UUID;
BEGIN
  SELECT p.full_name, m.branch_id INTO member_name, v_branch_id
  FROM members m JOIN profiles p ON p.id = m.user_id
  WHERE m.id = NEW.member_id;

  SELECT locker_number INTO locker_num FROM lockers WHERE id = NEW.locker_id;

  INSERT INTO notifications (user_id, branch_id, title, message, type, category)
  SELECT DISTINCT u_id, v_branch_id,
    'Locker Assigned',
    'Locker #' || COALESCE(locker_num, '?') || ' assigned to ' || COALESCE(member_name, 'a member'),
    'info', 'locker'
  FROM (
    SELECT ur.user_id AS u_id FROM user_roles ur WHERE ur.role IN ('owner', 'admin')
    UNION
    SELECT bm.user_id FROM branch_managers bm WHERE bm.branch_id = v_branch_id
    UNION
    SELECT sb.user_id FROM staff_branches sb WHERE sb.branch_id = v_branch_id
  ) recipients
  WHERE u_id IS NOT NULL;
  RETURN NEW;
END;
$$;

-- 5) MEMBERSHIP EXPIRING: member always, plus branch-scoped staff
CREATE OR REPLACE FUNCTION public.notify_membership_expiring()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  member_name TEXT;
  days_left INT;
BEGIN
  IF NEW.status = 'active' AND NEW.end_date IS NOT NULL THEN
    days_left := NEW.end_date - CURRENT_DATE;
    IF days_left IN (7, 3, 1) THEN
      SELECT p.full_name INTO member_name
      FROM members m JOIN profiles p ON p.id = m.user_id
      WHERE m.id = NEW.member_id;

      INSERT INTO notifications (user_id, branch_id, title, message, type, category)
      SELECT DISTINCT m.user_id, NEW.branch_id,
        'Membership Expiring Soon',
        'Your membership expires in ' || days_left || ' day(s). Please renew to continue.',
        'warning', 'membership'
      FROM members m
      WHERE m.id = NEW.member_id AND m.user_id IS NOT NULL;

      INSERT INTO notifications (user_id, branch_id, title, message, type, category)
      SELECT DISTINCT u_id, NEW.branch_id,
        'Member Expiring',
        COALESCE(member_name, 'A member') || '''s membership expires in ' || days_left || ' day(s)',
        'warning', 'membership'
      FROM (
        SELECT ur.user_id AS u_id FROM user_roles ur WHERE ur.role IN ('owner', 'admin')
        UNION
        SELECT bm.user_id FROM branch_managers bm WHERE bm.branch_id = NEW.branch_id
      ) recipients
      WHERE u_id IS NOT NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 6) Dedupe trigger: silently skip duplicate unread rows within last 60 sec.
--    Uses a regular index for fast lookup on (user_id, created_at).
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.notifications_dedupe_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = NEW.user_id
      AND n.title = NEW.title
      AND n.message = NEW.message
      AND n.is_read = false
      AND n.created_at > now() - interval '60 seconds'
  ) THEN
    RETURN NULL; -- silently skip duplicate
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_dedupe_before_insert ON public.notifications;
CREATE TRIGGER notifications_dedupe_before_insert
  BEFORE INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notifications_dedupe_guard();

-- 7) Ensure whatsapp_messages is in realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'whatsapp_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages';
  END IF;
END $$;

ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;