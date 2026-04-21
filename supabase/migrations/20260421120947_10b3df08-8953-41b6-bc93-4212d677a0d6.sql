-- 1. Tighten integration_settings: explicit WITH CHECK to ensure
--    only owners/admins can INSERT/UPDATE credentials.
DROP POLICY IF EXISTS "Admins can manage integration settings" ON public.integration_settings;
CREATE POLICY "Admins can manage integration settings"
ON public.integration_settings
FOR ALL
TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[])
)
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[])
);

-- 2. hardware_devices: add SELECT/manage policies (table had RLS on but 0 policies)
ALTER TABLE public.hardware_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view hardware devices" ON public.hardware_devices;
CREATE POLICY "Staff can view hardware devices"
ON public.hardware_devices
FOR SELECT
TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
);

DROP POLICY IF EXISTS "Admins can manage hardware devices" ON public.hardware_devices;
CREATE POLICY "Admins can manage hardware devices"
ON public.hardware_devices
FOR ALL
TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[])
)
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[])
);

-- 3. Tighten ai_tool_logs INSERT (was WITH CHECK true).
--    Restrict client inserts to staff+. Service-role key bypasses RLS so edge functions are unaffected.
DROP POLICY IF EXISTS "Service role can insert AI tool logs" ON public.ai_tool_logs;
CREATE POLICY "Staff can insert AI tool logs"
ON public.ai_tool_logs
FOR INSERT
TO authenticated
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
);

-- 4. Tighten rewards_ledger INSERT (was WITH CHECK true, only staff should insert)
DROP POLICY IF EXISTS "Staff can insert rewards_ledger" ON public.rewards_ledger;
CREATE POLICY "Staff can insert rewards_ledger"
ON public.rewards_ledger
FOR INSERT
TO authenticated
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
);