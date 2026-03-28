
ALTER TABLE members ADD COLUMN IF NOT EXISTS hardware_access_status text DEFAULT 'none';

ALTER TABLE access_devices ADD COLUMN IF NOT EXISTS public_ip text;

CREATE INDEX IF NOT EXISTS idx_members_hardware_access_status ON members(hardware_access_status) WHERE hardware_access_status != 'none';
