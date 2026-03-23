-- Allow trainer-safe queue upserts keyed by person UUID + device.
-- Deduplicate existing rows before adding the unique index.
DELETE FROM public.biometric_sync_queue a
USING public.biometric_sync_queue b
WHERE a.person_uuid = b.person_uuid
  AND a.device_id = b.device_id
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS biometric_sync_queue_person_uuid_device_unique
ON public.biometric_sync_queue (person_uuid, device_id);
