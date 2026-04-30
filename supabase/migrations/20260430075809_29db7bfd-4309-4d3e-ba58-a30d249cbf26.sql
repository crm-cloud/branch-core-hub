-- HOWBODY device inventory
CREATE TABLE public.howbody_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_no TEXT NOT NULL UNIQUE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  label TEXT,
  location TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_registered BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ,
  total_scans INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_howbody_devices_branch ON public.howbody_devices(branch_id);
CREATE INDEX idx_howbody_devices_active ON public.howbody_devices(is_active) WHERE is_active = true;

ALTER TABLE public.howbody_devices ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated staff/trainer/manager/admin/owner
CREATE POLICY "Staff can view howbody devices"
  ON public.howbody_devices FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'staff')
    OR public.has_role(auth.uid(), 'trainer')
  );

-- Write: owner/admin only
CREATE POLICY "Owner/admin can insert howbody devices"
  ON public.howbody_devices FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner/admin can update howbody devices"
  ON public.howbody_devices FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner/admin can delete howbody devices"
  ON public.howbody_devices FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_howbody_devices_updated_at
  BEFORE UPDATE ON public.howbody_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-register helper (called by webhooks via service role; SECURITY DEFINER bypasses RLS safely)
CREATE OR REPLACE FUNCTION public.howbody_touch_device(_equipment_no TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _equipment_no IS NULL OR length(trim(_equipment_no)) = 0 THEN
    RETURN;
  END IF;
  INSERT INTO public.howbody_devices (equipment_no, auto_registered, last_seen_at, total_scans)
  VALUES (_equipment_no, true, now(), 1)
  ON CONFLICT (equipment_no) DO UPDATE
    SET last_seen_at = now(),
        total_scans = public.howbody_devices.total_scans + 1;
END;
$$;

-- Seed the test device
INSERT INTO public.howbody_devices (equipment_no, label, notes, is_active, auto_registered)
VALUES ('HD0202501821', 'HOWBODY Test Device', 'Virtual device provided by HOWBODY for integration testing', true, false)
ON CONFLICT (equipment_no) DO NOTHING;