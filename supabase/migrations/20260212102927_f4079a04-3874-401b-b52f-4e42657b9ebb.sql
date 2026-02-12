
-- 1. Create facilities table
CREATE TABLE public.facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  benefit_type_id UUID NOT NULL REFERENCES public.benefit_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gender_access TEXT NOT NULL DEFAULT 'unisex' CHECK (gender_access IN ('male', 'female', 'unisex')),
  capacity INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

-- RLS: Management can CRUD
CREATE POLICY "Management full access on facilities" ON public.facilities
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]));

-- RLS: Members/staff can read active matching facilities
CREATE POLICY "Read matching facilities" ON public.facilities
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (
      gender_access = 'unisex'
      OR gender_access = (SELECT gender::text FROM public.profiles WHERE id = auth.uid())
      OR public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_facilities_updated_at
  BEFORE UPDATE ON public.facilities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add facility_id to benefit_slots
ALTER TABLE public.benefit_slots
  ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.facilities(id);

-- 3. Drop gender_access from benefit_types (moved to facilities)
ALTER TABLE public.benefit_types DROP COLUMN IF EXISTS gender_access;
