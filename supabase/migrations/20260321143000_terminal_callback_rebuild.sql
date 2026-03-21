CREATE TABLE IF NOT EXISTS public.hardware_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_sn TEXT NOT NULL UNIQUE,
  device_key TEXT UNIQUE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ip_address TEXT,
  last_online TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hardware_devices_branch_idx ON public.hardware_devices(branch_id);
CREATE INDEX IF NOT EXISTS hardware_devices_last_online_idx ON public.hardware_devices(last_online DESC);
CREATE INDEX IF NOT EXISTS hardware_devices_device_sn_lower_idx ON public.hardware_devices((lower(device_sn)));

CREATE TABLE IF NOT EXISTS public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_sn TEXT NOT NULL,
  hardware_device_id UUID REFERENCES public.hardware_devices(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL DEFAULT 'identify',
  result TEXT NOT NULL DEFAULT 'success',
  message TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS access_logs_branch_idx ON public.access_logs(branch_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS access_logs_member_idx ON public.access_logs(member_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS access_logs_device_sn_idx ON public.access_logs(device_sn, captured_at DESC);

ALTER TABLE public.hardware_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hardware_devices'
      AND policyname = 'Authenticated users can read hardware_devices'
  ) THEN
    CREATE POLICY "Authenticated users can read hardware_devices"
      ON public.hardware_devices
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'access_logs'
      AND policyname = 'Authenticated users can read access_logs'
  ) THEN
    CREATE POLICY "Authenticated users can read access_logs"
      ON public.access_logs
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'access_logs'
      AND policyname = 'Authenticated users can insert access_logs'
  ) THEN
    CREATE POLICY "Authenticated users can insert access_logs"
      ON public.access_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.hardware_devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.access_logs;
