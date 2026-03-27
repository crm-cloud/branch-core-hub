
-- Backfill mips_person_sn for already-synced records
UPDATE public.employees SET mips_person_sn = REPLACE(employee_code, '-', '') WHERE mips_sync_status = 'synced' AND mips_person_sn IS NULL AND employee_code IS NOT NULL;
UPDATE public.members SET mips_person_sn = REPLACE(member_code, '-', '') WHERE mips_sync_status = 'synced' AND mips_person_sn IS NULL AND member_code IS NOT NULL;
UPDATE public.trainers SET mips_person_sn = 'TRN' || UPPER(LEFT(id::text, 4)) WHERE mips_sync_status = 'synced' AND mips_person_sn IS NULL;
