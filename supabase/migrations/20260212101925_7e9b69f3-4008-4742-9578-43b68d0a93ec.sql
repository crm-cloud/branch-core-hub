
-- Issue 2: Gender-separated facility booking
ALTER TABLE public.benefit_types 
  ADD COLUMN IF NOT EXISTS gender_access TEXT DEFAULT 'unisex';

-- Issue 3: Auto-freeze trigger
CREATE OR REPLACE FUNCTION public.auto_freeze_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    IF NEW.start_date <= CURRENT_DATE THEN
      UPDATE public.memberships SET status = 'frozen' WHERE id = NEW.membership_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_freeze_membership
  AFTER UPDATE ON public.membership_freeze_history
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_freeze_membership();
