-- Task 5: trainer_code on trainers
ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS trainer_code TEXT;

CREATE OR REPLACE FUNCTION public.generate_trainer_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  branch_code TEXT;
  seq_num INTEGER;
BEGIN
  IF NEW.trainer_code IS NOT NULL AND NEW.trainer_code <> '' THEN
    RETURN NEW;
  END IF;
  SELECT code INTO branch_code FROM public.branches WHERE id = NEW.branch_id;
  IF branch_code IS NULL THEN branch_code := 'GEN'; END IF;
  SELECT COUNT(*) + 1 INTO seq_num FROM public.trainers WHERE branch_id = NEW.branch_id;
  NEW.trainer_code := 'TR-' || branch_code || '-' || LPAD(seq_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_trainer_code ON public.trainers;
CREATE TRIGGER trg_generate_trainer_code
BEFORE INSERT ON public.trainers
FOR EACH ROW EXECUTE FUNCTION public.generate_trainer_code();

-- Backfill existing rows
DO $$
DECLARE
  t RECORD;
  bcode TEXT;
  seq INT;
BEGIN
  FOR t IN SELECT id, branch_id FROM public.trainers WHERE trainer_code IS NULL OR trainer_code = '' ORDER BY created_at LOOP
    SELECT code INTO bcode FROM public.branches WHERE id = t.branch_id;
    IF bcode IS NULL THEN bcode := 'GEN'; END IF;
    SELECT COUNT(*) + 1 INTO seq FROM public.trainers WHERE branch_id = t.branch_id AND trainer_code IS NOT NULL;
    UPDATE public.trainers SET trainer_code = 'TR-' || bcode || '-' || LPAD(seq::TEXT, 5, '0') WHERE id = t.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trainers_trainer_code ON public.trainers(trainer_code);

-- Task 6: slip_url on payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS slip_url TEXT;

-- Storage bucket for payment slips (private)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-slips', 'payment-slips', false)
ON CONFLICT (id) DO NOTHING;

-- Staff can upload to payment-slips
DROP POLICY IF EXISTS "Staff can upload payment slips" ON storage.objects;
CREATE POLICY "Staff can upload payment slips"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-slips'
  AND public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
);

DROP POLICY IF EXISTS "Staff can view payment slips" ON storage.objects;
CREATE POLICY "Staff can view payment slips"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-slips'
  AND public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
);

DROP POLICY IF EXISTS "Staff can update payment slips" ON storage.objects;
CREATE POLICY "Staff can update payment slips"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-slips'
  AND public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
);

DROP POLICY IF EXISTS "Staff can delete payment slips" ON storage.objects;
CREATE POLICY "Staff can delete payment slips"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-slips'
  AND public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[])
);