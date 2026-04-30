
-- 1. bot_active flag for leads and members
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS bot_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS bot_active boolean NOT NULL DEFAULT true;

-- 2. campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','email','sms')),
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  message text NOT NULL,
  subject text,
  trigger_type text NOT NULL DEFAULT 'send_now' CHECK (trigger_type IN ('send_now','automated','scheduled')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','failed','paused')),
  recipients_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_branch ON public.campaigns(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);

-- 3. campaign_runs table
CREATE TABLE IF NOT EXISTS public.campaign_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  recipient_id uuid,
  recipient_type text CHECK (recipient_type IN ('member','lead')),
  recipient_phone text,
  recipient_email text,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_runs_campaign ON public.campaign_runs(campaign_id);

-- 4. RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view campaigns in their branch"
ON public.campaigns FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'owner') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'staff')
);

CREATE POLICY "Staff can create campaigns"
ON public.campaigns FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'owner') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'staff')
);

CREATE POLICY "Staff can update campaigns"
ON public.campaigns FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'owner') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'staff')
);

CREATE POLICY "Admins can delete campaigns"
ON public.campaigns FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'owner') OR
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Staff can view campaign runs"
ON public.campaign_runs FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'owner') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'staff')
);

CREATE POLICY "Staff can insert campaign runs"
ON public.campaign_runs FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'owner') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'staff')
);

-- 5. updated_at trigger for campaigns
CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 6. set_handoff RPC for AI auto-reply
CREATE OR REPLACE FUNCTION public.set_handoff(
  _phone text,
  _reason text DEFAULT 'AI handoff requested',
  _urgency text DEFAULT 'medium'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch uuid;
  v_member_id uuid;
  v_lead_id uuid;
BEGIN
  -- Flip per-chat bot_active
  UPDATE public.whatsapp_chat_settings
  SET bot_active = false, updated_at = now()
  WHERE phone_number = _phone;

  IF NOT FOUND THEN
    INSERT INTO public.whatsapp_chat_settings (phone_number, bot_active, created_at, updated_at)
    VALUES (_phone, false, now(), now())
    ON CONFLICT (phone_number) DO UPDATE SET bot_active = false, updated_at = now();
  END IF;

  -- Mirror to member
  SELECT m.id, m.branch_id INTO v_member_id, v_branch
  FROM public.members m
  JOIN public.profiles p ON p.user_id = m.user_id
  WHERE p.phone = _phone
  LIMIT 1;

  IF v_member_id IS NOT NULL THEN
    UPDATE public.members SET bot_active = false WHERE id = v_member_id;
  END IF;

  -- Mirror to lead (most recent)
  SELECT id, branch_id INTO v_lead_id, v_branch
  FROM public.leads
  WHERE phone = _phone
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_lead_id IS NOT NULL THEN
    UPDATE public.leads SET bot_active = false WHERE id = v_lead_id;
  END IF;

  -- Notify staff & managers in that branch (or globally if branch unknown)
  INSERT INTO public.notifications (user_id, branch_id, title, message, type, category, action_url, metadata)
  SELECT
    ur.user_id,
    v_branch,
    'AI Handoff Requested',
    COALESCE(_reason, 'A conversation needs human attention'),
    CASE WHEN _urgency = 'high' THEN 'warning' ELSE 'info' END,
    'whatsapp',
    '/whatsapp-chat?phone=' || _phone,
    jsonb_build_object('phone', _phone, 'reason', _reason, 'urgency', _urgency, 'source', 'ai_handoff')
  FROM public.user_roles ur
  WHERE ur.role IN ('owner','admin','manager','staff');
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_handoff(text, text, text) TO authenticated, service_role;
