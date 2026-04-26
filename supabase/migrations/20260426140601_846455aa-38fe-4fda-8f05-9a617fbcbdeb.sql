-- 1. Fix whatsapp_messages SELECT policy (manager branch isolation bug)
DROP POLICY IF EXISTS "Staff can view whatsapp messages for their branches" ON public.whatsapp_messages;

CREATE POLICY "Staff can view whatsapp messages for their branches"
ON public.whatsapp_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role])
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.branch_managers bm ON bm.user_id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'manager'::app_role
      AND bm.branch_id = whatsapp_messages.branch_id
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'staff'::app_role
  )
);

-- 2. Restrict mips_connections SELECT to owner/admin only (contains plaintext credentials)
DROP POLICY IF EXISTS "Staff can view MIPS connections" ON public.mips_connections;
DROP POLICY IF EXISTS "Staff can insert MIPS connections" ON public.mips_connections;
DROP POLICY IF EXISTS "Staff can update MIPS connections" ON public.mips_connections;

CREATE POLICY "Admins can view MIPS connections"
ON public.mips_connections
FOR SELECT
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE POLICY "Admins can insert MIPS connections"
ON public.mips_connections
FOR INSERT
TO authenticated
WITH CHECK (has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE POLICY "Admins can update MIPS connections"
ON public.mips_connections
FOR UPDATE
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]));

-- 3. Remove anonymous public read on organization_settings
DROP POLICY IF EXISTS "Public can read org settings" ON public.organization_settings;

-- 4. Remove anonymous public read on benefit_types (keep authenticated staff/role-scoped policies)
DROP POLICY IF EXISTS "Users can view benefit types for their branch" ON public.benefit_types;

-- 5. Realtime channel authorization - restrict broadcast subscriptions to authenticated staff
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated staff can receive realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated staff can send realtime messages" ON realtime.messages;

CREATE POLICY "Authenticated staff can receive realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role, 'staff'::app_role, 'trainer'::app_role])
);

CREATE POLICY "Authenticated staff can send realtime messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role, 'staff'::app_role, 'trainer'::app_role])
);