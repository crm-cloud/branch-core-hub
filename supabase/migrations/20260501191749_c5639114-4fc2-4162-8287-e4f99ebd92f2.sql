-- One-time DR readiness checklist
CREATE TABLE IF NOT EXISTS public.dr_readiness_checklist (
  step_no       int PRIMARY KEY,
  label         text NOT NULL,
  description   text,
  completed     boolean NOT NULL DEFAULT false,
  evidence      text,                          -- e.g. backup ID, PITR plan name, drill_log id
  completed_by  uuid,
  completed_at  timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dr_readiness_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_admins_manage_dr_readiness" ON public.dr_readiness_checklist;
CREATE POLICY "owners_admins_manage_dr_readiness" ON public.dr_readiness_checklist
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- Seed the 10 steps (idempotent)
INSERT INTO public.dr_readiness_checklist (step_no, label, description) VALUES
  (1,  'Provision Supabase Project B',
       'Create the standby Supabase project that will hold the warm DR copy.'),
  (2,  'Apply all migrations to Project B',
       'Run supabase db push against Project B so its schema matches Project A.'),
  (3,  'Add GitHub Actions secrets',
       'SUPABASE_ACCESS_TOKEN, PRIMARY_PROJECT_REF, DR_PROJECT_REF, PRIMARY_DB_URL, DR_DB_URL, DR_BUCKET, DR_SUPABASE_URL, DR_SUPABASE_ANON_KEY, DR_SERVICE_ROLE_KEY.'),
  (4,  'Run manual backup from primary',
       'Execute scripts/dr/backup.sh once and confirm manifest.json uploaded to DR_BUCKET.'),
  (5,  'Restore into Project B',
       'Run scripts/dr/restore.sh --i-understand-this-overwrites with the latest dump.'),
  (6,  'Run verify.sh and smoke-login.sh',
       'verify.sh exits 0 (row counts + storage SHA-256 match). smoke-login.sh confirms auth restore.'),
  (7,  'Confirm PITR enabled (or accept 24h RPO)',
       'Either enable PITR on Project A and record plan, or formally accept 24-hour RPO in writing.'),
  (8,  'Test dr_mode=true on critical write paths',
       'With dr_mode enabled, confirm UI + edge functions are blocked when writing invoices, payments, attendance, bookings, and rewards.'),
  (9,  'Confirm app-config.json switch works',
       'Build the DR mirror with VITE_APP_ENV=dr and confirm /app-config.json returns Project B URL with no-store headers.'),
  (10, 'Complete one quarterly DR drill',
       'Perform a full drill, fill all 10 acceptance flags in dr_drill_log, and record the drill_log id as evidence.')
ON CONFLICT (step_no) DO NOTHING;

-- Helper: DR is operational only when all 10 steps are completed
CREATE OR REPLACE FUNCTION public.dr_is_operational()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.dr_readiness_checklist WHERE completed = false
  );
$$;
GRANT EXECUTE ON FUNCTION public.dr_is_operational() TO authenticated, service_role;

-- Touch updated_at on every change
CREATE OR REPLACE FUNCTION public.dr_readiness_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dr_readiness_touch ON public.dr_readiness_checklist;
CREATE TRIGGER trg_dr_readiness_touch
  BEFORE UPDATE ON public.dr_readiness_checklist
  FOR EACH ROW EXECUTE FUNCTION public.dr_readiness_touch_updated_at();