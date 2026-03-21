
-- Table 1: hardware_devices (tracked by terminal-heartbeat)
CREATE TABLE public.hardware_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_sn text UNIQUE NOT NULL,
  device_key text,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  ip_address text,
  last_online timestamptz,
  last_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No RLS - only accessed via service_role from edge functions
ALTER TABLE public.hardware_devices ENABLE ROW LEVEL SECURITY;

-- Table 2: access_logs (event log for all terminal interactions)
CREATE TABLE public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_sn text NOT NULL,
  hardware_device_id uuid REFERENCES public.hardware_devices(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  result text,
  message text,
  captured_at timestamptz,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- Index for querying access logs by device and time
CREATE INDEX idx_access_logs_device_sn ON public.access_logs(device_sn);
CREATE INDEX idx_access_logs_created_at ON public.access_logs(created_at DESC);
CREATE INDEX idx_access_logs_member_id ON public.access_logs(member_id) WHERE member_id IS NOT NULL;
