-- Bulk-resolve all open error_logs after the audit pass
UPDATE public.error_logs
SET status = 'resolved', resolved_at = now()
WHERE status = 'open';

-- Helper to insert a member-facing notification (idempotent semantics: each call inserts one row)
CREATE OR REPLACE FUNCTION public.notify_member(
  p_user_id uuid,
  p_branch_id uuid,
  p_title text,
  p_message text,
  p_type text DEFAULT 'info',
  p_category text DEFAULT 'general'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, branch_id, title, message, type, category)
  VALUES (p_user_id, p_branch_id, p_title, p_message, p_type, p_category);
EXCEPTION WHEN OTHERS THEN
  -- never block the parent transaction
  NULL;
END;
$$;

-- Trigger: notify member on new invoice
CREATE OR REPLACE FUNCTION public.tg_notify_member_on_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NEW.member_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user_id FROM public.members WHERE id = NEW.member_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.notify_member(
    v_user_id,
    NEW.branch_id,
    'New invoice generated',
    'Invoice ' || COALESCE(NEW.invoice_number, '') || ' for ₹' || COALESCE(NEW.total_amount, 0)::text,
    'info',
    'billing'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_member_on_invoice_insert ON public.invoices;
CREATE TRIGGER notify_member_on_invoice_insert
AFTER INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_member_on_invoice();

-- Trigger: notify member on payment
CREATE OR REPLACE FUNCTION public.tg_notify_member_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_member_id uuid;
  v_branch_id uuid;
BEGIN
  -- payments are usually linked via invoice
  IF NEW.invoice_id IS NOT NULL THEN
    SELECT i.member_id, i.branch_id INTO v_member_id, v_branch_id FROM public.invoices i WHERE i.id = NEW.invoice_id;
  END IF;
  IF v_member_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user_id FROM public.members WHERE id = v_member_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.notify_member(
    v_user_id,
    v_branch_id,
    'Payment received',
    'We received your payment of ₹' || COALESCE(NEW.amount, 0)::text || '. Thank you!',
    'success',
    'billing'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_member_on_payment_insert ON public.payments;
CREATE TRIGGER notify_member_on_payment_insert
AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_member_on_payment();

-- Trigger: notify member on benefit booking
CREATE OR REPLACE FUNCTION public.tg_notify_member_on_benefit_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_facility_name text;
  v_branch_id uuid;
BEGIN
  IF NEW.member_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id, branch_id INTO v_user_id, v_branch_id FROM public.members WHERE id = NEW.member_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;
  -- Try to get facility name (best-effort)
  BEGIN
    SELECT bt.name INTO v_facility_name
    FROM public.facility_slots fs
    LEFT JOIN public.benefit_types bt ON bt.id = fs.benefit_type_id
    WHERE fs.id = NEW.slot_id;
  EXCEPTION WHEN OTHERS THEN
    v_facility_name := 'facility';
  END;
  PERFORM public.notify_member(
    v_user_id,
    v_branch_id,
    'Booking confirmed',
    'Your booking for ' || COALESCE(v_facility_name, 'a facility') || ' is confirmed.',
    'success',
    'booking'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_member_on_benefit_booking_insert ON public.benefit_bookings;
CREATE TRIGGER notify_member_on_benefit_booking_insert
AFTER INSERT ON public.benefit_bookings
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_member_on_benefit_booking();

-- Trigger: notify member on benefit credit added (add-on purchase)
CREATE OR REPLACE FUNCTION public.tg_notify_member_on_benefit_credit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_branch_id uuid;
BEGIN
  IF NEW.member_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id, branch_id INTO v_user_id, v_branch_id FROM public.members WHERE id = NEW.member_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.notify_member(
    v_user_id,
    v_branch_id,
    'Add-on credits added',
    COALESCE(NEW.total_credits, 0)::text || ' new benefit credits are available in your wallet.',
    'success',
    'benefits'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_member_on_benefit_credit_insert ON public.member_benefit_credits;
CREATE TRIGGER notify_member_on_benefit_credit_insert
AFTER INSERT ON public.member_benefit_credits
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_member_on_benefit_credit();