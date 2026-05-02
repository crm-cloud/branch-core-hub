-- ============================================================
-- P2.2 — Communication dispatcher infrastructure
-- ============================================================

-- 1) Extend delivery status enum with terminal "blocked" states
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'suppressed' AND enumtypid = 'reminder_delivery_status'::regtype) THEN
    ALTER TYPE reminder_delivery_status ADD VALUE 'suppressed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'deduped' AND enumtypid = 'reminder_delivery_status'::regtype) THEN
    ALTER TYPE reminder_delivery_status ADD VALUE 'deduped';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'queued' AND enumtypid = 'reminder_delivery_status'::regtype) THEN
    ALTER TYPE reminder_delivery_status ADD VALUE 'queued';
  END IF;
END$$;

-- 2) Dedupe key on communication_logs
ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS category  TEXT,
  ADD COLUMN IF NOT EXISTS channel   TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS communication_logs_dedupe_key_uniq
  ON public.communication_logs (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS communication_logs_category_sent_idx
  ON public.communication_logs (category, sent_at DESC)
  WHERE category IS NOT NULL;

-- 3) Extend notification_preferences with channel + category toggles + quiet hours
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS whatsapp_enabled              BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sms_enabled                   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_enabled                 BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS quiet_hours_start             TIME,
  ADD COLUMN IF NOT EXISTS quiet_hours_end               TIME,
  ADD COLUMN IF NOT EXISTS timezone                      TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS whatsapp_membership_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS whatsapp_payment_receipts     BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS whatsapp_class_notifications  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS whatsapp_announcements        BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS whatsapp_retention_nudges     BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sms_membership_reminders      BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sms_payment_receipts          BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sms_class_notifications       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sms_announcements             BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sms_retention_nudges          BOOLEAN NOT NULL DEFAULT TRUE;

-- 4) Per-member preferences table (members are not always auth users)
CREATE TABLE IF NOT EXISTS public.member_communication_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL UNIQUE REFERENCES public.members(id) ON DELETE CASCADE,
  branch_id   UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours_start TIME,
  quiet_hours_end   TIME,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  -- category opt-outs (default: opted in)
  membership_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  payment_receipts     BOOLEAN NOT NULL DEFAULT TRUE,
  class_notifications  BOOLEAN NOT NULL DEFAULT TRUE,
  announcements        BOOLEAN NOT NULL DEFAULT TRUE,
  retention_nudges     BOOLEAN NOT NULL DEFAULT TRUE,
  review_requests      BOOLEAN NOT NULL DEFAULT TRUE,
  marketing            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mcp_branch_idx ON public.member_communication_preferences(branch_id);

ALTER TABLE public.member_communication_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members manage own comm prefs" ON public.member_communication_preferences;
CREATE POLICY "members manage own comm prefs"
  ON public.member_communication_preferences
  FOR ALL
  TO authenticated
  USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
    OR has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role])
  )
  WITH CHECK (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
    OR has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role])
  );

DROP POLICY IF EXISTS "branch staff read comm prefs" ON public.member_communication_preferences;
CREATE POLICY "branch staff read comm prefs"
  ON public.member_communication_preferences
  FOR SELECT
  TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role])
    OR is_branch_member(branch_id)
  );

CREATE TRIGGER trg_mcp_updated_at
  BEFORE UPDATE ON public.member_communication_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Helpers used by dispatch-communication edge function
CREATE OR REPLACE FUNCTION public.is_in_quiet_hours(p_member_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start TIME;
  v_end   TIME;
  v_tz    TEXT;
  v_now   TIME;
BEGIN
  SELECT quiet_hours_start, quiet_hours_end, timezone
    INTO v_start, v_end, v_tz
  FROM public.member_communication_preferences
  WHERE member_id = p_member_id;

  IF v_start IS NULL OR v_end IS NULL THEN
    RETURN FALSE;
  END IF;

  v_now := (now() AT TIME ZONE COALESCE(v_tz, 'Asia/Kolkata'))::time;

  IF v_start <= v_end THEN
    RETURN v_now >= v_start AND v_now < v_end;
  ELSE
    -- wraps midnight (e.g. 22:00 → 07:00)
    RETURN v_now >= v_start OR v_now < v_end;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.should_send_communication(
  p_member_id UUID,
  p_channel   TEXT,    -- 'whatsapp' | 'sms' | 'email' | 'in_app'
  p_category  TEXT     -- see dispatcher categories
)
RETURNS TABLE(allowed BOOLEAN, reason TEXT)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs public.member_communication_preferences;
BEGIN
  -- Transactional always allowed (receipts, OTPs, security, hard-required ops)
  IF p_category = 'transactional' THEN
    RETURN QUERY SELECT TRUE, NULL::text; RETURN;
  END IF;

  -- in_app notifications use the existing notifications_dedupe_guard path; allow.
  IF p_channel = 'in_app' THEN
    RETURN QUERY SELECT TRUE, NULL::text; RETURN;
  END IF;

  IF p_member_id IS NULL THEN
    -- No member context (e.g. lead) — allow; lead-level opt-out lives elsewhere.
    RETURN QUERY SELECT TRUE, NULL::text; RETURN;
  END IF;

  SELECT * INTO v_prefs
  FROM public.member_communication_preferences
  WHERE member_id = p_member_id;

  -- Default-allow if no row exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT TRUE, NULL::text; RETURN;
  END IF;

  -- Channel-level kill switch
  IF p_channel = 'whatsapp' AND NOT v_prefs.whatsapp_enabled THEN
    RETURN QUERY SELECT FALSE, 'whatsapp_disabled'; RETURN;
  END IF;
  IF p_channel = 'sms' AND NOT v_prefs.sms_enabled THEN
    RETURN QUERY SELECT FALSE, 'sms_disabled'; RETURN;
  END IF;
  IF p_channel = 'email' AND NOT v_prefs.email_enabled THEN
    RETURN QUERY SELECT FALSE, 'email_disabled'; RETURN;
  END IF;

  -- Category-level opt-out
  IF p_category = 'membership_reminder' AND NOT v_prefs.membership_reminders THEN
    RETURN QUERY SELECT FALSE, 'category_opt_out'; RETURN;
  END IF;
  IF p_category = 'payment_receipt' AND NOT v_prefs.payment_receipts THEN
    RETURN QUERY SELECT FALSE, 'category_opt_out'; RETURN;
  END IF;
  IF p_category = 'class_notification' AND NOT v_prefs.class_notifications THEN
    RETURN QUERY SELECT FALSE, 'category_opt_out'; RETURN;
  END IF;
  IF p_category = 'announcement' AND NOT v_prefs.announcements THEN
    RETURN QUERY SELECT FALSE, 'category_opt_out'; RETURN;
  END IF;
  IF p_category = 'retention_nudge' AND NOT v_prefs.retention_nudges THEN
    RETURN QUERY SELECT FALSE, 'category_opt_out'; RETURN;
  END IF;
  IF p_category = 'review_request' AND NOT v_prefs.review_requests THEN
    RETURN QUERY SELECT FALSE, 'category_opt_out'; RETURN;
  END IF;
  IF p_category = 'marketing' AND NOT v_prefs.marketing THEN
    RETURN QUERY SELECT FALSE, 'category_opt_out'; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::text;
END;
$$;

COMMENT ON FUNCTION public.should_send_communication(UUID, TEXT, TEXT) IS
'Returns (allowed, reason). Single source of truth for outbound preference enforcement. Always TRUE for transactional and in_app channels.';

COMMENT ON COLUMN public.communication_logs.dedupe_key IS
'Caller-provided idempotency key. Unique partial index prevents double-sends across cron retries and webhook replays. Format: <topic>:<entity_id>[:<sub>]:<channel>';
