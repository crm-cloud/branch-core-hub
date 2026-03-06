
-- 1a. PT Packages: Add package_type and duration_months
ALTER TABLE public.pt_packages
  ADD COLUMN IF NOT EXISTS package_type text NOT NULL DEFAULT 'session_based',
  ADD COLUMN IF NOT EXISTS duration_months integer;

-- 1b. Trainer Commissions: Add release_date for amortized payouts
ALTER TABLE public.trainer_commissions
  ADD COLUMN IF NOT EXISTS release_date date DEFAULT CURRENT_DATE;

-- 1c. Ad Banners table
CREATE TABLE IF NOT EXISTS public.ad_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  image_url text NOT NULL,
  redirect_url text,
  title text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.ad_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read banners" ON public.ad_banners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage banners" ON public.ad_banners FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]));

-- 1d. Follow-Up Activities table
CREATE TABLE IF NOT EXISTS public.follow_up_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  reference_type text NOT NULL,
  reference_id text NOT NULL,
  action_taken text NOT NULL,
  notes text,
  next_follow_up_date date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.follow_up_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage follow-ups" ON public.follow_up_activities FOR ALL TO authenticated USING (true);

-- 1e. Update purchase_pt_package RPC for amortized commissions
CREATE OR REPLACE FUNCTION public.purchase_pt_package(
  _member_id uuid, _package_id uuid, _trainer_id uuid, _branch_id uuid, _price_paid numeric
)
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
  i INTEGER;
BEGIN
  -- Get package details
  SELECT * INTO _package FROM pt_packages WHERE id = _package_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Package not found or inactive');
  END IF;

  -- Get trainer commission rate
  SELECT pt_share_percentage INTO _commission_rate FROM trainers WHERE id = _trainer_id;
  _commission_rate := COALESCE(_commission_rate, 20);

  -- Create member PT package
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

  -- Calculate total commission
  _commission_amount := _price_paid * (_commission_rate / 100.0);

  -- Insert commissions: amortized for duration-based, single for session-based
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

  -- Auto-assign trainer to member if not already assigned
  UPDATE members SET assigned_trainer_id = _trainer_id
  WHERE id = _member_id AND assigned_trainer_id IS NULL;

  RETURN jsonb_build_object('success', true, 'member_package_id', _member_package_id);
END;
$function$;
