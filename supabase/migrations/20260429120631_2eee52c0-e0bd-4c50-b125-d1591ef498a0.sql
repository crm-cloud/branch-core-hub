
-- =========================================================
-- HOWBODY scanner integration
-- =========================================================

-- 1. Members: persistent third-party UID
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS howbody_third_uid uuid UNIQUE DEFAULT gen_random_uuid();

UPDATE public.members SET howbody_third_uid = gen_random_uuid() WHERE howbody_third_uid IS NULL;

-- 2. Plan capability flags
ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS body_scan_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS posture_scan_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scans_per_month integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS public_report_link boolean NOT NULL DEFAULT false;

-- 3. Token cache
CREATE TABLE IF NOT EXISTS public.howbody_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.howbody_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read howbody tokens"
  ON public.howbody_tokens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));

-- 4. Scan sessions
CREATE TABLE IF NOT EXISTS public.howbody_scan_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id text NOT NULL UNIQUE,
  equipment_no text NOT NULL,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','bound','completed','expired','failed')),
  bound_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_howbody_sessions_member ON public.howbody_scan_sessions(member_id);
ALTER TABLE public.howbody_scan_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Member reads own session"
  ON public.howbody_scan_sessions FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  );
CREATE POLICY "Staff reads sessions"
  ON public.howbody_scan_sessions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'owner'::app_role)
    OR public.has_role(auth.uid(),'manager'::app_role)
    OR public.has_role(auth.uid(),'staff'::app_role)
    OR public.has_role(auth.uid(),'trainer'::app_role)
  );

-- 5. Body composition reports
CREATE TABLE IF NOT EXISTS public.howbody_body_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  data_key text NOT NULL UNIQUE,
  equipment_no text,
  scan_id text,
  test_time timestamptz,
  health_score numeric,
  weight numeric, bmi numeric, pbf numeric, fat numeric,
  smm numeric, tbw numeric, pr numeric, bmr numeric,
  whr numeric, vfr numeric, metabolic_age integer,
  target_weight numeric, weight_control numeric, muscle_control numeric, fat_control numeric,
  icf numeric, ecf numeric,
  full_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_body_reports_member_time ON public.howbody_body_reports(member_id, test_time DESC);
ALTER TABLE public.howbody_body_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Member reads own body reports"
  ON public.howbody_body_reports FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));
CREATE POLICY "Staff reads body reports"
  ON public.howbody_body_reports FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'owner'::app_role)
    OR public.has_role(auth.uid(),'manager'::app_role)
    OR public.has_role(auth.uid(),'staff'::app_role)
    OR public.has_role(auth.uid(),'trainer'::app_role)
  );

-- 6. Posture reports
CREATE TABLE IF NOT EXISTS public.howbody_posture_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  data_key text NOT NULL UNIQUE,
  equipment_no text,
  scan_id text,
  test_time timestamptz,
  score numeric,
  head_forward numeric, head_slant numeric,
  shoulder_left numeric, shoulder_right numeric, high_low_shoulder numeric,
  pelvis_forward numeric,
  knee_left numeric, knee_right numeric,
  leg_left numeric, leg_right numeric,
  body_slope numeric,
  bust numeric, waist numeric, hip numeric,
  left_thigh numeric, right_thigh numeric,
  calf_left numeric, calf_right numeric,
  shoulder_back numeric,
  up_arm_left numeric, up_arm_right numeric,
  front_img text, left_img text, right_img text, back_img text, model_url text,
  full_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posture_reports_member_time ON public.howbody_posture_reports(member_id, test_time DESC);
ALTER TABLE public.howbody_posture_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Member reads own posture reports"
  ON public.howbody_posture_reports FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));
CREATE POLICY "Staff reads posture reports"
  ON public.howbody_posture_reports FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'owner'::app_role)
    OR public.has_role(auth.uid(),'manager'::app_role)
    OR public.has_role(auth.uid(),'staff'::app_role)
    OR public.has_role(auth.uid(),'trainer'::app_role)
  );

-- 7. Public shareable tokens
CREATE TABLE IF NOT EXISTS public.howbody_public_report_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_key text NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('body','posture')),
  token text NOT NULL UNIQUE,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_public_tokens_token ON public.howbody_public_report_tokens(token);
ALTER TABLE public.howbody_public_report_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone with token can read"
  ON public.howbody_public_report_tokens FOR SELECT TO anon, authenticated
  USING (true);

-- 8. Webhook log (last 500 hits, trimmed in code)
CREATE TABLE IF NOT EXISTS public.howbody_webhook_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL,
  third_uid text,
  data_key text,
  status_code integer,
  message text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_log_created ON public.howbody_webhook_log(created_at DESC);
ALTER TABLE public.howbody_webhook_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read webhook log"
  ON public.howbody_webhook_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'owner'::app_role));
