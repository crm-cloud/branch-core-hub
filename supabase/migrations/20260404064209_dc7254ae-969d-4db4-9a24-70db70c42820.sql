
-- Add SLA column to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sla_due_at timestamptz;

-- Index for SLA queries
CREATE INDEX IF NOT EXISTS idx_leads_sla_due ON public.leads (sla_due_at) WHERE sla_due_at IS NOT NULL;

-- Saved lead views table
CREATE TABLE IF NOT EXISTS public.saved_lead_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_lead_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved views"
  ON public.saved_lead_views FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own saved views"
  ON public.saved_lead_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved views"
  ON public.saved_lead_views FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved views"
  ON public.saved_lead_views FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_saved_lead_views_updated_at
  BEFORE UPDATE ON public.saved_lead_views
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
