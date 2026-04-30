-- 1. Campaign scheduling columns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS last_run_error text;

-- 2. Handoff metadata on chat settings
ALTER TABLE public.whatsapp_chat_settings
  ADD COLUMN IF NOT EXISTS handoff_reason text,
  ADD COLUMN IF NOT EXISTS handoff_requested_at timestamptz;

-- 3. Staff WhatsApp routing table
CREATE TABLE IF NOT EXISTS public.staff_whatsapp_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  personal_phone text NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  role_filter text[] NOT NULL DEFAULT ARRAY['manager','staff']::text[],
  last_assigned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_routing_branch_avail
  ON public.staff_whatsapp_routing(branch_id, is_available, last_assigned_at NULLS FIRST);

ALTER TABLE public.staff_whatsapp_routing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view routing in branch" ON public.staff_whatsapp_routing;
CREATE POLICY "Staff can view routing in branch"
  ON public.staff_whatsapp_routing FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff','trainer']::app_role[]));

DROP POLICY IF EXISTS "Users manage own routing row" ON public.staff_whatsapp_routing;
CREATE POLICY "Users manage own routing row"
  ON public.staff_whatsapp_routing FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

DROP POLICY IF EXISTS "Users update own routing row" ON public.staff_whatsapp_routing;
CREATE POLICY "Users update own routing row"
  ON public.staff_whatsapp_routing FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

DROP POLICY IF EXISTS "Admins delete routing rows" ON public.staff_whatsapp_routing;
CREATE POLICY "Admins delete routing rows"
  ON public.staff_whatsapp_routing FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

DROP TRIGGER IF EXISTS update_staff_routing_updated_at ON public.staff_whatsapp_routing;
CREATE TRIGGER update_staff_routing_updated_at
  BEFORE UPDATE ON public.staff_whatsapp_routing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Upgraded set_handoff RPC
CREATE OR REPLACE FUNCTION public.set_handoff(
  _phone text,
  _reason text DEFAULT NULL,
  _branch_id uuid DEFAULT NULL,
  _assigned_to uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned uuid := _assigned_to;
  v_settings_id uuid;
BEGIN
  -- Auto-pick next available staff in branch (round-robin) if not provided
  IF v_assigned IS NULL AND _branch_id IS NOT NULL THEN
    SELECT user_id INTO v_assigned
    FROM public.staff_whatsapp_routing
    WHERE branch_id = _branch_id AND is_available = true
    ORDER BY last_assigned_at NULLS FIRST, created_at ASC
    LIMIT 1;
  END IF;

  -- Pause bot, set assignment, record reason
  UPDATE public.whatsapp_chat_settings
     SET bot_active = false,
         paused_at = now(),
         paused_by = v_assigned,
         assigned_to = COALESCE(v_assigned, assigned_to),
         handoff_reason = COALESCE(_reason, handoff_reason),
         handoff_requested_at = now()
   WHERE phone_number = _phone
   RETURNING id INTO v_settings_id;

  -- Bump round-robin pointer
  IF v_assigned IS NOT NULL THEN
    UPDATE public.staff_whatsapp_routing
       SET last_assigned_at = now()
     WHERE user_id = v_assigned AND branch_id = _branch_id;
  END IF;

  -- Mirror status to leads / members
  UPDATE public.leads SET bot_active = false WHERE phone = _phone;
  UPDATE public.members m SET bot_active = false
  FROM public.profiles p WHERE p.id = m.user_id AND p.phone = _phone;

  -- In-app notifications
  INSERT INTO public.notifications (user_id, title, message, action_url)
  SELECT ur.user_id,
         'AI Handoff Requested',
         COALESCE(_reason, 'Member needs human assistance'),
         '/whatsapp-chat?phone=' || _phone
    FROM public.user_roles ur
   WHERE ur.role IN ('owner','admin','manager','staff')
     AND (v_assigned IS NULL OR ur.user_id = v_assigned);

  RETURN jsonb_build_object(
    'success', true,
    'assigned_to', v_assigned,
    'settings_id', v_settings_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_handoff(text, text, uuid, uuid) TO authenticated, service_role;