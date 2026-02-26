
-- Add hardware fields to members table
ALTER TABLE public.members 
  ADD COLUMN IF NOT EXISTS wiegand_code text,
  ADD COLUMN IF NOT EXISTS custom_welcome_message text DEFAULT 'Welcome! Enjoy your workout',
  ADD COLUMN IF NOT EXISTS hardware_access_enabled boolean DEFAULT true;

-- Create device_commands table for Realtime push commands
CREATE TABLE public.device_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.access_devices(id) ON DELETE CASCADE NOT NULL,
  command_type text NOT NULL DEFAULT 'relay_open',
  payload jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  issued_by uuid,
  issued_at timestamptz DEFAULT now(),
  executed_at timestamptz
);

-- Enable RLS
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can read device_commands
CREATE POLICY "Authenticated users can read device_commands"
  ON public.device_commands FOR SELECT TO authenticated
  USING (true);

-- RLS: Admin/owner/manager/staff can insert device_commands
CREATE POLICY "Staff can insert device_commands"
  ON public.device_commands FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager', 'staff')
    )
  );

-- RLS: Allow updates (for Android device to mark as executed)
CREATE POLICY "Authenticated users can update device_commands"
  ON public.device_commands FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable Realtime for device_commands
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_commands;

-- Auto-disable hardware access trigger
CREATE OR REPLACE FUNCTION public.auto_disable_hardware_access()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('frozen', 'expired', 'cancelled') AND OLD.status = 'active' THEN
    NEW.hardware_access_enabled := false;
  END IF;
  IF NEW.status = 'active' AND OLD.status IN ('frozen', 'expired') THEN
    NEW.hardware_access_enabled := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_auto_hardware_access
  BEFORE UPDATE OF status ON public.members
  FOR EACH ROW EXECUTE FUNCTION auto_disable_hardware_access();
