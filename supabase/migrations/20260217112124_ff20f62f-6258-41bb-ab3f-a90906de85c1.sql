
-- Organization settings table
CREATE TABLE IF NOT EXISTS public.organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT,
  logo_url TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  currency TEXT DEFAULT 'INR',
  fiscal_year_start TEXT DEFAULT 'April',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(branch_id)
);

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- Staff/admin can read
CREATE POLICY "Staff can view org settings"
  ON public.organization_settings FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

-- Owner/admin can modify
CREATE POLICY "Admin can manage org settings"
  ON public.organization_settings FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

-- Updated_at trigger
CREATE TRIGGER update_organization_settings_updated_at
  BEFORE UPDATE ON public.organization_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
