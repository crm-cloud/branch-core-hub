DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_lifecycle_status') THEN
    CREATE TYPE public.referral_lifecycle_status AS ENUM ('invited', 'joined', 'purchased', 'converted', 'rewarded', 'claimed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_transaction_status') THEN
    CREATE TYPE public.payment_transaction_status AS ENUM ('created', 'pending_confirmation', 'settled', 'failed', 'voided');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reminder_delivery_status') THEN
    CREATE TYPE public.reminder_delivery_status AS ENUM ('scheduled', 'sending', 'sent', 'failed', 'skipped');
  END IF;
END $$;

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS lifecycle_status public.referral_lifecycle_status,
  ADD COLUMN IF NOT EXISTS last_status_change_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS qualifying_invoice_id uuid,
  ADD COLUMN IF NOT EXISTS rewarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.referrals
SET lifecycle_status = CASE
  WHEN referred_member_id IS NULL THEN 'invited'::public.referral_lifecycle_status
  WHEN converted_at IS NOT NULL OR status::text = 'converted' THEN 'converted'::public.referral_lifecycle_status
  ELSE 'joined'::public.referral_lifecycle_status
END
WHERE lifecycle_status IS NULL;

ALTER TABLE public.referrals
  ALTER COLUMN lifecycle_status SET NOT NULL,
  ALTER COLUMN lifecycle_status SET DEFAULT 'invited'::public.referral_lifecycle_status;

ALTER TABLE public.referral_rewards
  ADD COLUMN IF NOT EXISTS claim_idempotency_key text,
  ADD COLUMN IF NOT EXISTS claimed_wallet_txn_id uuid;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS lifecycle_status public.payment_transaction_status NOT NULL DEFAULT 'created'::public.payment_transaction_status,
  ADD COLUMN IF NOT EXISTS payment_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS lifecycle_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.payments
SET lifecycle_status = CASE status::text
  WHEN 'completed' THEN 'settled'::public.payment_transaction_status
  WHEN 'failed' THEN 'failed'::public.payment_transaction_status
  WHEN 'refunded' THEN 'voided'::public.payment_transaction_status
  ELSE 'pending_confirmation'::public.payment_transaction_status
END
WHERE lifecycle_status = 'created'::public.payment_transaction_status
  AND status::text <> 'pending';

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS lifecycle_status public.payment_transaction_status NOT NULL DEFAULT 'created'::public.payment_transaction_status,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS settled_payment_id uuid,
  ADD COLUMN IF NOT EXISTS payment_link_url text,
  ADD COLUMN IF NOT EXISTS lifecycle_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.payment_transactions
SET lifecycle_status = CASE status
  WHEN 'paid' THEN 'settled'::public.payment_transaction_status
  WHEN 'failed' THEN 'failed'::public.payment_transaction_status
  WHEN 'cancelled' THEN 'voided'::public.payment_transaction_status
  WHEN 'created' THEN 'created'::public.payment_transaction_status
  ELSE 'pending_confirmation'::public.payment_transaction_status
END
WHERE lifecycle_status = 'created'::public.payment_transaction_status
  AND status <> 'created';

ALTER TABLE public.payment_reminders
  ADD COLUMN IF NOT EXISTS delivery_status public.reminder_delivery_status NOT NULL DEFAULT 'scheduled'::public.reminder_delivery_status,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.payment_reminders
SET delivery_status = CASE lower(coalesce(status, 'pending'))
  WHEN 'sent' THEN 'sent'::public.reminder_delivery_status
  WHEN 'failed' THEN 'failed'::public.reminder_delivery_status
  WHEN 'skipped' THEN 'skipped'::public.reminder_delivery_status
  WHEN 'sending' THEN 'sending'::public.reminder_delivery_status
  ELSE 'scheduled'::public.reminder_delivery_status
END;

ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS delivery_status public.reminder_delivery_status NOT NULL DEFAULT 'scheduled'::public.reminder_delivery_status,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.communication_logs
SET delivery_status = CASE lower(coalesce(status, 'sent'))
  WHEN 'sent' THEN 'sent'::public.reminder_delivery_status
  WHEN 'failed' THEN 'failed'::public.reminder_delivery_status
  WHEN 'skipped' THEN 'skipped'::public.reminder_delivery_status
  WHEN 'sending' THEN 'sending'::public.reminder_delivery_status
  ELSE 'scheduled'::public.reminder_delivery_status
END;

ALTER TABLE public.branch_settings
  ADD COLUMN IF NOT EXISTS block_access_on_overdue boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS overdue_grace_days integer NOT NULL DEFAULT 3;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_storage_path text;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS avatar_storage_path text,
  ADD COLUMN IF NOT EXISTS biometric_photo_path text,
  ADD COLUMN IF NOT EXISTS lifecycle_state text NOT NULL DEFAULT 'active';

ALTER TABLE public.trainers
  ADD COLUMN IF NOT EXISTS avatar_storage_path text,
  ADD COLUMN IF NOT EXISTS biometric_photo_path text;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS avatar_storage_path text,
  ADD COLUMN IF NOT EXISTS biometric_photo_path text;

CREATE TABLE IF NOT EXISTS public.member_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  member_id uuid NOT NULL,
  actor_user_id uuid,
  entity_type text NOT NULL,
  entity_id uuid,
  event_type text NOT NULL,
  previous_state text,
  new_state text,
  source text,
  reason text,
  idempotency_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referral_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL,
  referrer_member_id uuid NOT NULL,
  referred_member_id uuid,
  actor_user_id uuid,
  previous_state public.referral_lifecycle_status,
  new_state public.referral_lifecycle_status NOT NULL,
  source text,
  reason text,
  idempotency_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  payment_id uuid,
  payment_transaction_id uuid,
  invoice_id uuid,
  member_id uuid,
  actor_user_id uuid,
  event_type text NOT NULL,
  previous_state text,
  new_state text,
  source text,
  idempotency_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hardware_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  member_id uuid NOT NULL,
  actor_user_id uuid,
  previous_status text,
  new_status text NOT NULL,
  reason text,
  requires_sync boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.communication_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  communication_log_id uuid,
  reminder_id uuid,
  member_id uuid,
  actor_user_id uuid,
  channel text NOT NULL,
  previous_status public.reminder_delivery_status,
  new_status public.reminder_delivery_status NOT NULL,
  provider text,
  provider_message_id text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware_access_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_delivery_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'member_lifecycle_events' AND policyname = 'Staff view member lifecycle events') THEN
    CREATE POLICY "Staff view member lifecycle events"
    ON public.member_lifecycle_events
    FOR SELECT
    USING (
      has_any_role(auth.uid(), ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role, 'trainer'::public.app_role])
      AND ((branch_id = get_user_branch(auth.uid())) OR manages_branch(auth.uid(), branch_id))
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'member_lifecycle_events' AND policyname = 'Members view own lifecycle events') THEN
    CREATE POLICY "Members view own lifecycle events"
    ON public.member_lifecycle_events
    FOR SELECT
    USING (member_id = get_member_id(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'referral_lifecycle_events' AND policyname = 'Staff view referral lifecycle events') THEN
    CREATE POLICY "Staff view referral lifecycle events"
    ON public.referral_lifecycle_events
    FOR SELECT
    USING (
      has_any_role(auth.uid(), ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role, 'trainer'::public.app_role])
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'referral_lifecycle_events' AND policyname = 'Members view own referral lifecycle events') THEN
    CREATE POLICY "Members view own referral lifecycle events"
    ON public.referral_lifecycle_events
    FOR SELECT
    USING (
      referrer_member_id = get_member_id(auth.uid()) OR referred_member_id = get_member_id(auth.uid())
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_lifecycle_events' AND policyname = 'Staff view payment lifecycle events') THEN
    CREATE POLICY "Staff view payment lifecycle events"
    ON public.payment_lifecycle_events
    FOR SELECT
    USING (
      has_any_role(auth.uid(), ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role])
      AND ((branch_id = get_user_branch(auth.uid())) OR manages_branch(auth.uid(), branch_id))
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_lifecycle_events' AND policyname = 'Members view own payment lifecycle events') THEN
    CREATE POLICY "Members view own payment lifecycle events"
    ON public.payment_lifecycle_events
    FOR SELECT
    USING (member_id = get_member_id(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hardware_access_events' AND policyname = 'Staff view hardware access events') THEN
    CREATE POLICY "Staff view hardware access events"
    ON public.hardware_access_events
    FOR SELECT
    USING (
      has_any_role(auth.uid(), ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role])
      AND ((branch_id = get_user_branch(auth.uid())) OR manages_branch(auth.uid(), branch_id))
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hardware_access_events' AND policyname = 'Members view own hardware access events') THEN
    CREATE POLICY "Members view own hardware access events"
    ON public.hardware_access_events
    FOR SELECT
    USING (member_id = get_member_id(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'communication_delivery_events' AND policyname = 'Staff view communication delivery events') THEN
    CREATE POLICY "Staff view communication delivery events"
    ON public.communication_delivery_events
    FOR SELECT
    USING (
      has_any_role(auth.uid(), ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role])
      AND ((branch_id = get_user_branch(auth.uid())) OR manages_branch(auth.uid(), branch_id))
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'communication_delivery_events' AND policyname = 'Members view own communication delivery events') THEN
    CREATE POLICY "Members view own communication delivery events"
    ON public.communication_delivery_events
    FOR SELECT
    USING (member_id = get_member_id(auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_referrals_lifecycle_status ON public.referrals (lifecycle_status, referrer_member_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_unique_pair ON public.referrals (referrer_member_id, referred_phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key ON public.payments (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_idempotency_key ON public.payment_transactions (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_reminders_delivery_status ON public.payment_reminders (delivery_status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_member_lifecycle_events_member_id_created_at ON public.member_lifecycle_events (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_lifecycle_events_referral_id_created_at ON public.referral_lifecycle_events (referral_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_lifecycle_events_invoice_id_created_at ON public.payment_lifecycle_events (invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hardware_access_events_member_id_created_at ON public.hardware_access_events (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_delivery_events_log_id_created_at ON public.communication_delivery_events (communication_log_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.can_manage_member_lifecycle(_user_id uuid, _member_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member public.members%ROWTYPE;
BEGIN
  SELECT * INTO v_member
  FROM public.members
  WHERE id = _member_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_member.user_id = _user_id THEN
    RETURN true;
  END IF;

  IF public.has_any_role(_user_id, ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role])
     AND ((v_member.branch_id = public.get_user_branch(_user_id)) OR public.manages_branch(_user_id, v_member.branch_id)) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.trainers t
    WHERE t.user_id = _user_id
      AND t.id = v_member.assigned_trainer_id
      AND COALESCE(t.is_active, true)
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_member_lifecycle_event(
  _branch_id uuid,
  _member_id uuid,
  _actor_user_id uuid,
  _entity_type text,
  _entity_id uuid,
  _event_type text,
  _previous_state text,
  _new_state text,
  _source text,
  _reason text,
  _idempotency_key text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.member_lifecycle_events (
    branch_id, member_id, actor_user_id, entity_type, entity_id, event_type,
    previous_state, new_state, source, reason, idempotency_key, metadata
  ) VALUES (
    _branch_id, _member_id, _actor_user_id, _entity_type, _entity_id, _event_type,
    _previous_state, _new_state, _source, _reason, _idempotency_key, COALESCE(_metadata, '{}'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.advance_referral_lifecycle(
  p_referral_id uuid,
  p_target_status public.referral_lifecycle_status,
  p_actor_user_id uuid DEFAULT auth.uid(),
  p_reason text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_qualifying_invoice_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral public.referrals%ROWTYPE;
  v_current_order integer;
  v_target_order integer;
BEGIN
  SELECT * INTO v_referral
  FROM public.referrals
  WHERE id = p_referral_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral not found');
  END IF;

  IF p_idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.referral_lifecycle_events
    WHERE referral_id = p_referral_id AND idempotency_key = p_idempotency_key
  ) THEN
    RETURN jsonb_build_object('success', true, 'referral_id', p_referral_id, 'status', v_referral.lifecycle_status, 'idempotent', true);
  END IF;

  v_current_order := array_position(ARRAY['invited','joined','purchased','converted','rewarded','claimed']::text[], v_referral.lifecycle_status::text);
  v_target_order := array_position(ARRAY['invited','joined','purchased','converted','rewarded','claimed']::text[], p_target_status::text);

  IF v_target_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral status');
  END IF;

  IF v_current_order IS NOT NULL AND v_target_order < v_current_order THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral lifecycle cannot move backwards');
  END IF;

  IF v_referral.lifecycle_status = p_target_status THEN
    RETURN jsonb_build_object('success', true, 'referral_id', p_referral_id, 'status', p_target_status, 'idempotent', true);
  END IF;

  UPDATE public.referrals
  SET lifecycle_status = p_target_status,
      status = CASE WHEN p_target_status IN ('converted','rewarded','claimed') THEN 'converted'::public.lead_status ELSE status END,
      converted_at = CASE WHEN p_target_status IN ('converted','rewarded','claimed') THEN COALESCE(converted_at, now()) ELSE converted_at END,
      qualifying_invoice_id = COALESCE(p_qualifying_invoice_id, qualifying_invoice_id),
      rewarded_at = CASE WHEN p_target_status IN ('rewarded','claimed') THEN COALESCE(rewarded_at, now()) ELSE rewarded_at END,
      claimed_at = CASE WHEN p_target_status = 'claimed' THEN COALESCE(claimed_at, now()) ELSE claimed_at END,
      last_status_change_at = now(),
      metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb)
  WHERE id = p_referral_id;

  INSERT INTO public.referral_lifecycle_events (
    referral_id, referrer_member_id, referred_member_id, actor_user_id, previous_state, new_state,
    source, reason, idempotency_key, metadata
  ) VALUES (
    v_referral.id, v_referral.referrer_member_id, v_referral.referred_member_id, p_actor_user_id,
    v_referral.lifecycle_status, p_target_status, p_source, p_reason, p_idempotency_key, COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN jsonb_build_object('success', true, 'referral_id', p_referral_id, 'status', p_target_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_referral_reward(
  p_referral_id uuid,
  p_invoice_id uuid,
  p_actor_user_id uuid DEFAULT auth.uid(),
  p_source text DEFAULT 'payment_settlement',
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral public.referrals%ROWTYPE;
  v_existing_reward uuid;
  v_reward_value numeric := 0;
  v_reward_id uuid;
BEGIN
  SELECT * INTO v_referral
  FROM public.referrals
  WHERE id = p_referral_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral not found');
  END IF;

  SELECT id INTO v_existing_reward
  FROM public.referral_rewards
  WHERE referral_id = p_referral_id
  LIMIT 1;

  IF v_existing_reward IS NOT NULL THEN
    PERFORM public.advance_referral_lifecycle(p_referral_id, 'rewarded', p_actor_user_id, 'Reward already exists', p_source, p_idempotency_key, jsonb_build_object('invoice_id', p_invoice_id));
    RETURN jsonb_build_object('success', true, 'reward_id', v_existing_reward, 'idempotent', true);
  END IF;

  SELECT COALESCE(rr.reward_amount, 0)
  INTO v_reward_value
  FROM public.referral_reward_rules rr
  WHERE rr.is_active = true
  ORDER BY rr.created_at DESC
  LIMIT 1;

  IF v_reward_value IS NULL OR v_reward_value <= 0 THEN
    v_reward_value := 0;
  END IF;

  INSERT INTO public.referral_rewards (
    referral_id, member_id, reward_type, reward_value, description
  ) VALUES (
    p_referral_id,
    v_referral.referrer_member_id,
    'wallet_credit',
    v_reward_value,
    'Referral conversion reward'
  ) RETURNING id INTO v_reward_id;

  PERFORM public.advance_referral_lifecycle(
    p_referral_id,
    'rewarded',
    p_actor_user_id,
    'Referral reward issued',
    p_source,
    p_idempotency_key,
    jsonb_build_object('invoice_id', p_invoice_id, 'reward_id', v_reward_id)
  );

  RETURN jsonb_build_object('success', true, 'reward_id', v_reward_id, 'reward_value', v_reward_value);
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_member_access_state(
  p_member_id uuid,
  p_actor_user_id uuid DEFAULT auth.uid(),
  p_reason text DEFAULT NULL,
  p_force_sync boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member public.members%ROWTYPE;
  v_branch_settings public.branch_settings%ROWTYPE;
  v_has_active_membership boolean := false;
  v_has_frozen_membership boolean := false;
  v_has_overdue boolean := false;
  v_new_status text := 'none';
  v_previous_status text;
BEGIN
  SELECT * INTO v_member
  FROM public.members
  WHERE id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member not found');
  END IF;

  SELECT * INTO v_branch_settings
  FROM public.branch_settings
  WHERE branch_id = v_member.branch_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.memberships ms
    WHERE ms.member_id = p_member_id
      AND ms.status = 'active'::public.membership_status
      AND ms.start_date <= current_date
      AND ms.end_date >= current_date
  ) INTO v_has_active_membership;

  SELECT EXISTS (
    SELECT 1
    FROM public.memberships ms
    WHERE ms.member_id = p_member_id
      AND ms.status = 'frozen'::public.membership_status
      AND ms.start_date <= current_date
      AND COALESCE(ms.end_date, current_date) >= current_date
  ) INTO v_has_frozen_membership;

  SELECT EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.member_id = p_member_id
      AND i.status IN ('pending'::public.invoice_status, 'partial'::public.invoice_status, 'overdue'::public.invoice_status)
      AND i.due_date IS NOT NULL
      AND i.due_date < (current_date - COALESCE(v_branch_settings.overdue_grace_days, 3))
  ) INTO v_has_overdue;

  v_previous_status := COALESCE(v_member.hardware_access_status, 'none');

  IF v_member.status IN ('suspended'::public.member_status, 'blacklisted'::public.member_status) THEN
    v_new_status := 'blocked_member_status';
  ELSIF v_has_frozen_membership THEN
    v_new_status := 'frozen';
  ELSIF COALESCE(v_branch_settings.block_access_on_overdue, true) AND v_has_overdue THEN
    v_new_status := 'blocked_overdue';
  ELSIF v_has_active_membership THEN
    v_new_status := 'active';
  ELSE
    v_new_status := 'expired';
  END IF;

  UPDATE public.members
  SET hardware_access_status = v_new_status,
      hardware_access_enabled = (v_new_status = 'active'),
      updated_at = now()
  WHERE id = p_member_id;

  IF v_previous_status IS DISTINCT FROM v_new_status OR p_force_sync THEN
    INSERT INTO public.hardware_access_events (
      branch_id, member_id, actor_user_id, previous_status, new_status, reason, requires_sync, metadata
    ) VALUES (
      v_member.branch_id,
      p_member_id,
      p_actor_user_id,
      v_previous_status,
      v_new_status,
      p_reason,
      true,
      jsonb_build_object(
        'had_active_membership', v_has_active_membership,
        'had_frozen_membership', v_has_frozen_membership,
        'had_overdue', v_has_overdue
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'member_id', p_member_id,
    'previous_status', v_previous_status,
    'hardware_access_status', v_new_status,
    'hardware_access_enabled', v_new_status = 'active',
    'requires_sync', (v_previous_status IS DISTINCT FROM v_new_status) OR p_force_sync
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_referral_reward(
  p_reward_id uuid,
  p_member_id uuid,
  p_idempotency_key text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward public.referral_rewards%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_wallet_txn_id uuid;
  v_new_balance numeric;
BEGIN
  SELECT * INTO v_reward
  FROM public.referral_rewards
  WHERE id = p_reward_id
    AND member_id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward not found');
  END IF;

  IF v_reward.is_claimed THEN
    RETURN jsonb_build_object(
      'success', true,
      'reward_id', p_reward_id,
      'claimed', true,
      'idempotent', true,
      'wallet_transaction_id', v_reward.claimed_wallet_txn_id
    );
  END IF;

  IF p_idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.referral_rewards rr
    WHERE rr.id = p_reward_id
      AND rr.claim_idempotency_key = p_idempotency_key
  ) THEN
    RETURN jsonb_build_object('success', true, 'reward_id', p_reward_id, 'claimed', true, 'idempotent', true);
  END IF;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE member_id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.wallets (member_id, balance, total_credited, total_debited)
    VALUES (p_member_id, 0, 0, 0)
    RETURNING * INTO v_wallet;
  END IF;

  v_new_balance := COALESCE(v_wallet.balance, 0) + COALESCE(v_reward.reward_value, 0);

  INSERT INTO public.wallet_transactions (
    wallet_id, txn_type, amount, balance_after, description, reference_type, reference_id, created_by
  ) VALUES (
    v_wallet.id,
    'credit',
    COALESCE(v_reward.reward_value, 0),
    v_new_balance,
    COALESCE(v_reward.description, 'Referral reward claim'),
    'referral_reward',
    p_reward_id,
    p_actor_user_id
  ) RETURNING id INTO v_wallet_txn_id;

  UPDATE public.wallets
  SET balance = v_new_balance,
      total_credited = COALESCE(total_credited, 0) + COALESCE(v_reward.reward_value, 0),
      updated_at = now()
  WHERE id = v_wallet.id;

  UPDATE public.referral_rewards
  SET is_claimed = true,
      claimed_at = now(),
      claim_idempotency_key = COALESCE(p_idempotency_key, claim_idempotency_key),
      claimed_wallet_txn_id = v_wallet_txn_id
  WHERE id = p_reward_id;

  PERFORM public.advance_referral_lifecycle(
    v_reward.referral_id,
    'claimed',
    p_actor_user_id,
    'Referral reward claimed',
    'reward_claim',
    p_idempotency_key,
    jsonb_build_object('wallet_transaction_id', v_wallet_txn_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'reward_id', p_reward_id,
    'wallet_transaction_id', v_wallet_txn_id,
    'new_balance', v_new_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_payment(
  p_branch_id uuid,
  p_invoice_id uuid,
  p_member_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_transaction_id text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_received_by uuid DEFAULT NULL,
  p_income_category_id uuid DEFAULT NULL,
  p_payment_source text DEFAULT 'manual',
  p_idempotency_key text DEFAULT NULL,
  p_gateway_payment_id text DEFAULT NULL,
  p_payment_transaction_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_payment_id uuid;
  v_new_amount_paid numeric;
  v_new_status public.invoice_status;
  v_wallet public.wallets%ROWTYPE;
  v_new_balance numeric;
  v_existing_payment public.payments%ROWTYPE;
  v_membership_ids uuid[] := ARRAY[]::uuid[];
  v_referral_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_payment
    FROM public.payments
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_existing_payment.id,
        'new_amount_paid', p_amount,
        'new_status', v_existing_payment.status,
        'idempotent', true
      );
    END IF;
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF v_invoice.branch_id <> p_branch_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice branch mismatch');
  END IF;

  IF p_member_id IS NOT NULL AND v_invoice.member_id IS NOT NULL AND v_invoice.member_id <> p_member_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice member mismatch');
  END IF;

  IF v_invoice.status IN ('cancelled'::public.invoice_status, 'refunded'::public.invoice_status) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot settle this invoice');
  END IF;

  IF COALESCE(v_invoice.amount_paid, 0) + p_amount > COALESCE(v_invoice.total_amount, 0) + 0.01 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment exceeds invoice balance');
  END IF;

  IF p_payment_method = 'wallet' THEN
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE member_id = COALESCE(p_member_id, v_invoice.member_id)
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    IF COALESCE(v_wallet.balance, 0) < p_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient wallet balance');
    END IF;

    v_new_balance := COALESCE(v_wallet.balance, 0) - p_amount;

    INSERT INTO public.wallet_transactions (
      wallet_id, txn_type, amount, balance_after, description, reference_type, reference_id, created_by
    ) VALUES (
      v_wallet.id,
      'debit',
      p_amount,
      v_new_balance,
      'Payment for invoice',
      'invoice',
      p_invoice_id,
      p_received_by
    );

    UPDATE public.wallets
    SET balance = v_new_balance,
        total_debited = COALESCE(total_debited, 0) + p_amount,
        updated_at = now()
    WHERE id = v_wallet.id;
  END IF;

  INSERT INTO public.payments (
    branch_id, invoice_id, member_id, amount, payment_method, transaction_id,
    notes, received_by, status, income_category_id, lifecycle_status, payment_source,
    idempotency_key, settled_at, lifecycle_metadata
  ) VALUES (
    p_branch_id,
    p_invoice_id,
    COALESCE(p_member_id, v_invoice.member_id),
    p_amount,
    p_payment_method::public.payment_method,
    COALESCE(p_gateway_payment_id, p_transaction_id),
    p_notes,
    p_received_by,
    'completed'::public.payment_status,
    p_income_category_id,
    'settled'::public.payment_transaction_status,
    p_payment_source,
    p_idempotency_key,
    now(),
    COALESCE(p_metadata, '{}'::jsonb)
      || jsonb_build_object('gateway_payment_id', p_gateway_payment_id, 'payment_transaction_id', p_payment_transaction_id)
  ) RETURNING id INTO v_payment_id;

  v_new_amount_paid := COALESCE(v_invoice.amount_paid, 0) + p_amount;
  IF v_new_amount_paid >= COALESCE(v_invoice.total_amount, 0) THEN
    v_new_status := 'paid'::public.invoice_status;
  ELSIF v_new_amount_paid > 0 THEN
    v_new_status := 'partial'::public.invoice_status;
  ELSE
    v_new_status := 'pending'::public.invoice_status;
  END IF;

  UPDATE public.invoices
  SET amount_paid = v_new_amount_paid,
      status = v_new_status,
      updated_at = now()
  WHERE id = p_invoice_id;

  IF p_payment_transaction_id IS NOT NULL THEN
    UPDATE public.payment_transactions
    SET lifecycle_status = 'settled'::public.payment_transaction_status,
        status = 'paid',
        gateway_payment_id = COALESCE(p_gateway_payment_id, gateway_payment_id),
        settled_payment_id = v_payment_id,
        updated_at = now(),
        lifecycle_metadata = lifecycle_metadata || COALESCE(p_metadata, '{}'::jsonb)
    WHERE id = p_payment_transaction_id;
  END IF;

  SELECT array_agg(reference_id) FILTER (WHERE reference_type = 'membership' AND reference_id IS NOT NULL)
  INTO v_membership_ids
  FROM public.invoice_items
  WHERE invoice_id = p_invoice_id;

  IF v_new_status = 'paid' AND v_membership_ids IS NOT NULL THEN
    UPDATE public.memberships
    SET status = 'active'::public.membership_status,
        updated_at = now()
    WHERE id = ANY(v_membership_ids)
      AND status = 'pending'::public.membership_status;

    IF COALESCE(p_member_id, v_invoice.member_id) IS NOT NULL THEN
      PERFORM public.log_member_lifecycle_event(
        p_branch_id,
        COALESCE(p_member_id, v_invoice.member_id),
        p_received_by,
        'invoice',
        p_invoice_id,
        'invoice_paid',
        v_invoice.status::text,
        v_new_status::text,
        p_payment_source,
        p_notes,
        p_idempotency_key,
        COALESCE(p_metadata, '{}'::jsonb)
      );
    END IF;
  END IF;

  IF COALESCE(p_member_id, v_invoice.member_id) IS NOT NULL THEN
    SELECT r.id INTO v_referral_id
    FROM public.referrals r
    WHERE r.referred_member_id = COALESCE(p_member_id, v_invoice.member_id)
    ORDER BY r.created_at DESC
    LIMIT 1;

    IF v_referral_id IS NOT NULL THEN
      PERFORM public.advance_referral_lifecycle(
        v_referral_id,
        CASE WHEN v_new_status = 'paid' THEN 'converted'::public.referral_lifecycle_status ELSE 'purchased'::public.referral_lifecycle_status END,
        p_received_by,
        'Payment settled for referred member',
        p_payment_source,
        p_idempotency_key,
        jsonb_build_object('invoice_id', p_invoice_id, 'payment_id', v_payment_id),
        p_invoice_id
      );

      IF v_new_status = 'paid' THEN
        PERFORM public.issue_referral_reward(v_referral_id, p_invoice_id, p_received_by, p_payment_source, p_idempotency_key);
      END IF;
    END IF;

    PERFORM public.evaluate_member_access_state(COALESCE(p_member_id, v_invoice.member_id), p_received_by, 'Payment settled', true);
  END IF;

  INSERT INTO public.payment_lifecycle_events (
    branch_id, payment_id, payment_transaction_id, invoice_id, member_id, actor_user_id,
    event_type, previous_state, new_state, source, idempotency_key, metadata
  ) VALUES (
    p_branch_id,
    v_payment_id,
    p_payment_transaction_id,
    p_invoice_id,
    COALESCE(p_member_id, v_invoice.member_id),
    p_received_by,
    'payment_settled',
    v_invoice.status::text,
    v_new_status::text,
    p_payment_source,
    p_idempotency_key,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'new_amount_paid', v_new_amount_paid,
    'new_status', v_new_status,
    'membership_ids', COALESCE(v_membership_ids, ARRAY[]::uuid[])
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_payment(
  p_branch_id uuid,
  p_invoice_id uuid,
  p_member_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_transaction_id text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_received_by uuid DEFAULT NULL,
  p_income_category_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.settle_payment(
    p_branch_id,
    p_invoice_id,
    p_member_id,
    p_amount,
    p_payment_method,
    p_transaction_id,
    p_notes,
    p_received_by,
    p_income_category_id,
    'manual',
    NULL,
    NULL,
    NULL,
    '{}'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.void_payment(
  p_payment_id uuid,
  p_reason text DEFAULT 'Voided by admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_invoice public.invoices%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_new_amount_paid numeric;
  v_new_status public.invoice_status;
  v_new_balance numeric;
BEGIN
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  IF v_payment.lifecycle_status = 'voided'::public.payment_transaction_status OR v_payment.status = 'refunded'::public.payment_status THEN
    RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'idempotent', true);
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = v_payment.invoice_id
  FOR UPDATE;

  IF v_payment.payment_method = 'wallet'::public.payment_method THEN
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE member_id = v_payment.member_id
    FOR UPDATE;

    IF FOUND THEN
      v_new_balance := COALESCE(v_wallet.balance, 0) + COALESCE(v_payment.amount, 0);

      INSERT INTO public.wallet_transactions (
        wallet_id, txn_type, amount, balance_after, description, reference_type, reference_id, created_by
      ) VALUES (
        v_wallet.id,
        'credit',
        v_payment.amount,
        v_new_balance,
        'Refund for voided payment',
        'payment',
        v_payment.id,
        auth.uid()
      );

      UPDATE public.wallets
      SET balance = v_new_balance,
          total_credited = COALESCE(total_credited, 0) + COALESCE(v_payment.amount, 0),
          updated_at = now()
      WHERE id = v_wallet.id;
    END IF;
  END IF;

  v_new_amount_paid := GREATEST(COALESCE(v_invoice.amount_paid, 0) - COALESCE(v_payment.amount, 0), 0);
  IF v_new_amount_paid >= COALESCE(v_invoice.total_amount, 0) THEN
    v_new_status := 'paid'::public.invoice_status;
  ELSIF v_new_amount_paid > 0 THEN
    v_new_status := 'partial'::public.invoice_status;
  ELSE
    v_new_status := 'pending'::public.invoice_status;
  END IF;

  UPDATE public.payments
  SET status = 'refunded'::public.payment_status,
      lifecycle_status = 'voided'::public.payment_transaction_status,
      void_reason = p_reason,
      voided_at = now(),
      voided_by = auth.uid(),
      lifecycle_metadata = lifecycle_metadata || jsonb_build_object('void_reason', p_reason)
  WHERE id = p_payment_id;

  UPDATE public.invoices
  SET amount_paid = v_new_amount_paid,
      status = v_new_status,
      updated_at = now()
  WHERE id = v_invoice.id;

  IF v_payment.invoice_id IS NOT NULL THEN
    UPDATE public.payment_transactions
    SET lifecycle_status = 'voided'::public.payment_transaction_status,
        status = 'cancelled',
        updated_at = now()
    WHERE settled_payment_id = p_payment_id;
  END IF;

  IF v_payment.member_id IS NOT NULL THEN
    UPDATE public.memberships
    SET status = 'pending'::public.membership_status,
        updated_at = now()
    WHERE id IN (
      SELECT ii.reference_id
      FROM public.invoice_items ii
      WHERE ii.invoice_id = v_payment.invoice_id
        AND ii.reference_type = 'membership'
        AND ii.reference_id IS NOT NULL
    )
      AND status = 'active'::public.membership_status;

    PERFORM public.evaluate_member_access_state(v_payment.member_id, auth.uid(), p_reason, true);
  END IF;

  INSERT INTO public.payment_lifecycle_events (
    branch_id, payment_id, invoice_id, member_id, actor_user_id,
    event_type, previous_state, new_state, source, metadata
  ) VALUES (
    v_payment.branch_id,
    v_payment.id,
    v_payment.invoice_id,
    v_payment.member_id,
    auth.uid(),
    'payment_voided',
    v_invoice.status::text,
    v_new_status::text,
    'void_payment',
    jsonb_build_object('reason', p_reason)
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'voided_amount', v_payment.amount,
    'invoice_new_status', v_new_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_private_member_media(_user_id uuid, _path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_member public.members%ROWTYPE;
BEGIN
  IF split_part(_path, '/', 1) <> 'members' THEN
    RETURN false;
  END IF;

  BEGIN
    v_member_id := split_part(_path, '/', 2)::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  SELECT * INTO v_member
  FROM public.members
  WHERE id = v_member_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_member.user_id = _user_id THEN
    RETURN true;
  END IF;

  RETURN public.can_manage_member_lifecycle(_user_id, v_member_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_private_member_media(_user_id uuid, _path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.can_access_private_member_media(_user_id, _path);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_private_staff_media(_user_id uuid, _path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_type text := split_part(_path, '/', 1);
  v_entity_id uuid;
BEGIN
  BEGIN
    v_entity_id := split_part(_path, '/', 2)::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  IF public.has_any_role(_user_id, ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role, 'staff'::public.app_role]) THEN
    RETURN true;
  END IF;

  IF v_entity_type = 'trainers' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.trainers t WHERE t.id = v_entity_id AND t.user_id = _user_id
    );
  END IF;

  IF v_entity_type = 'employees' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.employees e WHERE e.id = v_entity_id AND e.user_id = _user_id
    );
  END IF;

  RETURN false;
END;
$$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('member-media', 'member-media', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-media', 'staff-media', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authorized users can view member media') THEN
    CREATE POLICY "Authorized users can view member media"
    ON storage.objects
    FOR SELECT
    USING (
      bucket_id = 'member-media'
      AND public.can_access_private_member_media(auth.uid(), name)
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authorized users can upload member media') THEN
    CREATE POLICY "Authorized users can upload member media"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'member-media'
      AND public.can_manage_private_member_media(auth.uid(), name)
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authorized users can update member media') THEN
    CREATE POLICY "Authorized users can update member media"
    ON storage.objects
    FOR UPDATE
    USING (
      bucket_id = 'member-media'
      AND public.can_manage_private_member_media(auth.uid(), name)
    )
    WITH CHECK (
      bucket_id = 'member-media'
      AND public.can_manage_private_member_media(auth.uid(), name)
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authorized users can delete member media') THEN
    CREATE POLICY "Authorized users can delete member media"
    ON storage.objects
    FOR DELETE
    USING (
      bucket_id = 'member-media'
      AND public.can_manage_private_member_media(auth.uid(), name)
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authorized users can view staff media') THEN
    CREATE POLICY "Authorized users can view staff media"
    ON storage.objects
    FOR SELECT
    USING (
      bucket_id = 'staff-media'
      AND public.can_access_private_staff_media(auth.uid(), name)
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authorized users can upload staff media') THEN
    CREATE POLICY "Authorized users can upload staff media"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'staff-media'
      AND public.can_access_private_staff_media(auth.uid(), name)
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authorized users can update staff media') THEN
    CREATE POLICY "Authorized users can update staff media"
    ON storage.objects
    FOR UPDATE
    USING (
      bucket_id = 'staff-media'
      AND public.can_access_private_staff_media(auth.uid(), name)
    )
    WITH CHECK (
      bucket_id = 'staff-media'
      AND public.can_access_private_staff_media(auth.uid(), name)
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authorized users can delete staff media') THEN
    CREATE POLICY "Authorized users can delete staff media"
    ON storage.objects
    FOR DELETE
    USING (
      bucket_id = 'staff-media'
      AND public.can_access_private_staff_media(auth.uid(), name)
    );
  END IF;
END $$;