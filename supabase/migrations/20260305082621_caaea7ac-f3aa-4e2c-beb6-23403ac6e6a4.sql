-- Fix notification triggers to include 'staff' role so staff users get notifications

CREATE OR REPLACE FUNCTION public.notify_new_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  member_name TEXT;
BEGIN
  SELECT p.full_name INTO member_name FROM profiles p WHERE p.id = NEW.user_id;
  INSERT INTO notifications (user_id, branch_id, title, message, type, category)
  SELECT ur.user_id, NEW.branch_id,
    'New Member Registered',
    'New member registration: ' || COALESCE(member_name, 'Unknown'),
    'info', 'member'
  FROM user_roles ur
  WHERE ur.role IN ('owner', 'admin', 'staff')
    AND ur.user_id != COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid);
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_payment_received()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  member_name TEXT;
BEGIN
  SELECT p.full_name INTO member_name
  FROM members m JOIN profiles p ON p.id = m.user_id
  WHERE m.id = NEW.member_id;

  INSERT INTO notifications (user_id, branch_id, title, message, type, category)
  SELECT ur.user_id, NEW.branch_id,
    'Payment Received',
    'Payment of ₹' || NEW.amount || ' received from ' || COALESCE(member_name, 'a member'),
    'success', 'payment'
  FROM user_roles ur
  WHERE ur.role IN ('owner', 'admin', 'staff');
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_lead_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO notifications (user_id, branch_id, title, message, type, category)
  SELECT ur.user_id, NEW.branch_id,
    'New Lead Captured',
    'New lead: ' || COALESCE(NEW.full_name, 'Unknown') || ' (' || COALESCE(NEW.source, 'Direct') || ')',
    'info', 'lead'
  FROM user_roles ur WHERE ur.role IN ('owner', 'admin', 'manager', 'staff');
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_locker_assigned()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM user_roles ur WHERE ur.role IN ('owner', 'admin', 'staff');
  RETURN NEW;
END; $function$;