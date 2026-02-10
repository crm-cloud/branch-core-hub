
-- Enable realtime on notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger: notify on new member registration
CREATE OR REPLACE FUNCTION public.notify_new_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  WHERE ur.role IN ('owner', 'admin')
    AND ur.user_id != COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid);
  RETURN NEW;
END; $$;

CREATE TRIGGER trigger_notify_new_member
  AFTER INSERT ON public.members FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_member();

-- Trigger: notify on payment received
CREATE OR REPLACE FUNCTION public.notify_payment_received()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  WHERE ur.role IN ('owner', 'admin');
  RETURN NEW;
END; $$;

CREATE TRIGGER trigger_notify_payment_received
  AFTER INSERT ON public.payments FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_received();
