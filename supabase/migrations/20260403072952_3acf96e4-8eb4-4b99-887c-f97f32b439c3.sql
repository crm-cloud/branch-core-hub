
-- Create a safe view that masks password
CREATE OR REPLACE VIEW public.mips_connections_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  branch_id,
  server_url,
  username,
  '********' AS password,
  is_active,
  created_at,
  updated_at
FROM public.mips_connections;

-- Drop existing policies
DROP POLICY IF EXISTS "Staff can view MIPS connections" ON public.mips_connections;
DROP POLICY IF EXISTS "Staff can manage MIPS connections" ON public.mips_connections;

-- Restrictive SELECT policy for staff only
CREATE POLICY "Staff can view MIPS connections"
ON public.mips_connections
FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

-- Staff can insert/update (to save credentials)
CREATE POLICY "Staff can insert MIPS connections"
ON public.mips_connections
FOR INSERT
TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

CREATE POLICY "Staff can update MIPS connections"
ON public.mips_connections
FOR UPDATE
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));
