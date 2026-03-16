
-- 1. Fix purchase_pt_package: remove ::text cast on reference_id
CREATE OR REPLACE FUNCTION public.purchase_pt_package(_member_id uuid, _package_id uuid, _trainer_id uuid, _branch_id uuid, _price_paid numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _package RECORD;
  _member_package_id UUID;
  _commission_amount NUMERIC;
  _monthly_commission NUMERIC;
  _trainer RECORD;
  _commission_rate NUMERIC;
  _invoice_id UUID;
  i INTEGER;
BEGIN
  SELECT * INTO _package FROM pt_packages WHERE id = _package_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Package not found or inactive');
  END IF;

  SELECT pt_share_percentage INTO _commission_rate FROM trainers WHERE id = _trainer_id;
  _commission_rate := COALESCE(_commission_rate, 20);

  INSERT INTO member_pt_packages (
    member_id, package_id, trainer_id, branch_id,
    sessions_total, sessions_remaining, price_paid,
    start_date, expiry_date, status
  ) VALUES (
    _member_id, _package_id, _trainer_id, _branch_id,
    CASE WHEN _package.package_type = 'duration_based' THEN 0 ELSE _package.total_sessions END,
    CASE WHEN _package.package_type = 'duration_based' THEN 0 ELSE _package.total_sessions END,
    _price_paid,
    CURRENT_DATE,
    CASE WHEN _package.package_type = 'duration_based' THEN CURRENT_DATE + (_package.duration_months * 30)
         ELSE CURRENT_DATE + _package.validity_days END,
    'active'
  ) RETURNING id INTO _member_package_id;

  INSERT INTO invoices (
    branch_id, member_id, subtotal, total_amount, amount_paid, status, due_date, invoice_type
  ) VALUES (
    _branch_id, _member_id, _price_paid, _price_paid, _price_paid, 'paid', CURRENT_DATE, 'pt_package'
  ) RETURNING id INTO _invoice_id;

  INSERT INTO invoice_items (
    invoice_id, description, unit_price, quantity, total_amount, reference_type, reference_id
  ) VALUES (
    _invoice_id, 'PT Package - ' || _package.name, _price_paid, 1, _price_paid, 'pt_package', _member_package_id
  );

  INSERT INTO payments (
    invoice_id, member_id, branch_id, amount, payment_method, status, payment_date
  ) VALUES (
    _invoice_id, _member_id, _branch_id, _price_paid, 'cash', 'completed', now()
  );

  _commission_amount := _price_paid * (_commission_rate / 100.0);

  IF _package.package_type = 'duration_based' AND _package.duration_months > 0 THEN
    _monthly_commission := ROUND(_commission_amount / _package.duration_months, 2);
    FOR i IN 0..(_package.duration_months - 1) LOOP
      INSERT INTO trainer_commissions (
        trainer_id, pt_package_id, commission_type, amount, percentage, status, release_date
      ) VALUES (
        _trainer_id, _member_package_id, 'package_sale',
        _monthly_commission, _commission_rate, 'pending',
        CURRENT_DATE + (i * 30)
      );
    END LOOP;
  ELSE
    INSERT INTO trainer_commissions (
      trainer_id, pt_package_id, commission_type, amount, percentage, release_date
    ) VALUES (
      _trainer_id, _member_package_id, 'package_sale', _commission_amount, _commission_rate, CURRENT_DATE
    );
  END IF;

  UPDATE members SET assigned_trainer_id = _trainer_id
  WHERE id = _member_id AND assigned_trainer_id IS NULL;

  RETURN jsonb_build_object('success', true, 'member_package_id', _member_package_id, 'invoice_id', _invoice_id);
END;
$function$;

-- 2. Create member_comps table
CREATE TABLE IF NOT EXISTS public.member_comps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  benefit_type_id uuid NOT NULL REFERENCES public.benefit_types(id) ON DELETE CASCADE,
  comp_sessions integer NOT NULL DEFAULT 1,
  used_sessions integer NOT NULL DEFAULT 0,
  reason text,
  granted_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_comps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage comps" ON public.member_comps
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','staff','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','staff','manager']::app_role[]));

CREATE POLICY "Members can view own comps" ON public.member_comps
  FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

-- 3. Create member_documents table
CREATE TABLE IF NOT EXISTS public.member_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'other',
  file_url text NOT NULL,
  file_name text NOT NULL,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage documents" ON public.member_documents
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','staff','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','staff','manager']::app_role[]));

CREATE POLICY "Members can view own documents" ON public.member_documents
  FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));
