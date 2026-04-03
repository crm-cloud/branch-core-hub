
-- =====================================================
-- Marketing CRM Schema Upgrade
-- =====================================================

-- 1. Add CRM columns to existing leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS temperature text NOT NULL DEFAULT 'warm';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS score integer NOT NULL DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_content text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_term text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS landing_page text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS referrer_url text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS preferred_contact_channel text NOT NULL DEFAULT 'phone';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS budget text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS goals text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lost_reason text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_action_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS first_response_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS won_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.leads(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.leads(id);

-- 2. Create unified lead_activities table
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  actor_id uuid REFERENCES public.profiles(id),
  activity_type text NOT NULL,
  title text,
  notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Performance indexes
CREATE INDEX IF NOT EXISTS idx_leads_branch_status ON public.leads(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON public.leads(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_next_action ON public.leads(next_action_at) WHERE next_action_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_temperature ON public.leads(temperature);
CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON public.lead_activities(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_activities_branch ON public.lead_activities(branch_id);

-- 4. RLS for lead_activities
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view lead activities"
ON public.lead_activities
FOR SELECT
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
);

CREATE POLICY "Staff can create lead activities"
ON public.lead_activities
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
);

CREATE POLICY "Staff can update lead activities"
ON public.lead_activities
FOR UPDATE
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
);

CREATE POLICY "Admins can delete lead activities"
ON public.lead_activities
FOR DELETE
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[])
);
