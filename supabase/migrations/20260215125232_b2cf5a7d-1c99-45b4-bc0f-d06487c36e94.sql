
-- FIX remaining "RLS always true" policies

-- 1. benefit_types: restrict to staff/trainer/admin
DROP POLICY IF EXISTS "Staff can manage benefit types" ON public.benefit_types;

CREATE POLICY "Staff view benefit types"
ON public.benefit_types FOR SELECT
USING (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer','member']::app_role[])
);

CREATE POLICY "Staff manage benefit types"
ON public.benefit_types FOR INSERT
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
);

CREATE POLICY "Staff update benefit types"
ON public.benefit_types FOR UPDATE
USING (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
);

CREATE POLICY "Staff delete benefit types"
ON public.benefit_types FOR DELETE
USING (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[])
);

-- 2. referral_settings: restrict to managers+
DROP POLICY IF EXISTS "Managers can manage referral settings" ON public.referral_settings;

CREATE POLICY "Managers view referral settings"
ON public.referral_settings FOR SELECT
USING (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','member']::app_role[])
);

CREATE POLICY "Managers manage referral settings"
ON public.referral_settings FOR INSERT
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[])
);

CREATE POLICY "Managers update referral settings"
ON public.referral_settings FOR UPDATE
USING (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[])
);

CREATE POLICY "Managers delete referral settings"
ON public.referral_settings FOR DELETE
USING (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[])
);

-- 3. device_access_events INSERT - this is from devices (verify_jwt=false), needs to stay permissive
-- but restrict to staff or service role calls
DROP POLICY IF EXISTS "System can insert access events" ON public.device_access_events;

CREATE POLICY "System insert access events"
ON public.device_access_events FOR INSERT
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
  OR auth.uid() IS NULL -- allows service role / edge function calls
);
