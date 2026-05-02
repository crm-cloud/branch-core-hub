
-- ============================================
-- PHASE 3+4: Group Purchase Hardening + Rewards
-- ============================================

-- Group reward bonus settings (branch-scoped, fall back to global NULL row)
INSERT INTO public.settings (branch_id, key, value, description)
VALUES
  (NULL, 'group_reward_bonus_pct', '5'::jsonb, 'Group purchase bonus % (over per-member earned points)'),
  (NULL, 'group_couple_multiplier', '1.5'::jsonb, 'Multiplier applied to group bonus for couple groups')
ON CONFLICT (branch_id, key) DO NOTHING;

-- Helper: read a numeric setting with branch fallback
CREATE OR REPLACE FUNCTION public.get_setting_numeric(p_branch_id uuid, p_key text, p_default numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT (value)::text::numeric FROM public.settings WHERE branch_id = p_branch_id AND key = p_key LIMIT 1),
    (SELECT (value)::text::numeric FROM public.settings WHERE branch_id IS NULL  AND key = p_key LIMIT 1),
    p_default
  );
$$;

-- Award group bonus (idempotent on group+member+source)
CREATE OR REPLACE FUNCTION public.award_group_bonus(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_group public.member_groups%ROWTYPE;
  v_pct numeric;
  v_mult numeric := 1;
  v_member record;
  v_inv_total numeric;
  v_bonus int;
  v_total_awarded int := 0;
  v_rate numeric; -- points per rupee
  v_ref text;
BEGIN
  SELECT * INTO v_group FROM public.member_groups WHERE id = p_group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'GROUP_NOT_FOUND'; END IF;

  v_pct  := public.get_setting_numeric(v_group.branch_id, 'group_reward_bonus_pct', 5);
  IF v_group.group_type = 'couple' THEN
    v_mult := public.get_setting_numeric(v_group.branch_id, 'group_couple_multiplier', 1.5);
  END IF;

  -- 1 point per rupee by default; reuse existing engine constant if present
  v_rate := public.get_setting_numeric(v_group.branch_id, 'reward_points_per_rupee', 1);

  FOR v_member IN
    SELECT mgm.member_id
    FROM public.member_group_members mgm
    WHERE mgm.group_id = p_group_id
  LOOP
    -- Sum invoices tied to this group purchase for this member
    SELECT COALESCE(SUM(i.total_amount), 0) INTO v_inv_total
    FROM public.invoices i
    WHERE i.member_id = v_member.member_id
      AND i.branch_id = v_group.branch_id
      AND i.notes ILIKE '%' || v_group.group_name || '%'
      AND i.created_at >= v_group.created_at - INTERVAL '5 minutes';

    v_bonus := FLOOR(v_inv_total * (v_pct/100.0) * v_mult * v_rate)::int;
    IF v_bonus <= 0 THEN CONTINUE; END IF;

    v_ref := 'group_bonus:' || p_group_id::text;

    -- Idempotency: skip if already awarded for this group+member
    IF EXISTS (
      SELECT 1 FROM public.rewards_ledger
      WHERE member_id = v_member.member_id
        AND reference_type = 'group_bonus'
        AND reference_id = p_group_id::text
    ) THEN CONTINUE; END IF;

    INSERT INTO public.rewards_ledger (member_id, branch_id, points, reason, reference_type, reference_id)
    VALUES (
      v_member.member_id, v_group.branch_id, v_bonus,
      format('Group bonus (%s) — %s', v_group.group_type, v_group.group_name),
      'group_bonus', p_group_id::text
    );
    v_total_awarded := v_total_awarded + v_bonus;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'group_id', p_group_id, 'total_points', v_total_awarded);
END $$;

-- Hardened group purchase
CREATE OR REPLACE FUNCTION public.purchase_group_membership(
  p_branch_id uuid, p_member_ids uuid[], p_plan_id uuid, p_start_date date,
  p_group_name text, p_group_type text DEFAULT 'friends',
  p_discount_type text DEFAULT 'percentage', p_discount_value numeric DEFAULT 0,
  p_payment_method text DEFAULT 'cash', p_include_gst boolean DEFAULT false,
  p_notes text DEFAULT NULL, p_received_by uuid DEFAULT auth.uid()
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan public.membership_plans%ROWTYPE;
  v_member_id uuid;
  v_group_id uuid;
  v_results jsonb := '[]'::jsonb;
  v_member_count int;
  v_base_price numeric;
  v_admission numeric;
  v_gross_per_member numeric;
  v_discount_per_member numeric;
  v_purchase_result jsonb;
  v_idempotency_key text;
  v_bonus_result jsonb;
  v_member_check record;
  v_dup_count int;
BEGIN
  -- ---------- Validation ----------
  IF p_member_ids IS NULL OR array_length(p_member_ids, 1) IS NULL OR array_length(p_member_ids, 1) < 2 THEN
    RAISE EXCEPTION 'GROUP_REQUIRES_MIN_2_MEMBERS' USING ERRCODE = '22023';
  END IF;
  IF p_group_type NOT IN ('couple','family','corporate','friends') THEN
    RAISE EXCEPTION 'INVALID_GROUP_TYPE' USING ERRCODE = '22023';
  END IF;

  v_member_count := array_length(p_member_ids, 1);

  IF p_group_type = 'couple' AND v_member_count <> 2 THEN
    RAISE EXCEPTION 'COUPLE_REQUIRES_EXACTLY_2_MEMBERS' USING ERRCODE = '22023';
  END IF;

  -- duplicate ids
  SELECT COUNT(*) - COUNT(DISTINCT x) INTO v_dup_count
  FROM unnest(p_member_ids) x;
  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'DUPLICATE_MEMBER_IN_GROUP' USING ERRCODE = '22023';
  END IF;

  -- branch + status check
  FOR v_member_check IN
    SELECT id, branch_id, status FROM public.members WHERE id = ANY(p_member_ids)
  LOOP
    IF v_member_check.branch_id <> p_branch_id THEN
      RAISE EXCEPTION 'MEMBER_BRANCH_MISMATCH: %', v_member_check.id USING ERRCODE = '22023';
    END IF;
    IF v_member_check.status <> 'active' THEN
      RAISE EXCEPTION 'MEMBER_NOT_ACTIVE: %', v_member_check.id USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- not already in active group for the same plan
  IF EXISTS (
    SELECT 1
    FROM public.member_group_members mgm
    JOIN public.member_groups g ON g.id = mgm.group_id
    WHERE g.is_active = true
      AND mgm.member_id = ANY(p_member_ids)
  ) THEN
    RAISE EXCEPTION 'ALREADY_IN_ACTIVE_GROUP' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_plan FROM public.membership_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  v_base_price := COALESCE(v_plan.discounted_price, v_plan.price, 0);
  v_admission := COALESCE(v_plan.admission_fee, 0);
  v_gross_per_member := v_base_price + v_admission;

  -- discount range
  IF p_discount_type = 'percentage' THEN
    IF p_discount_value < 0 OR p_discount_value > 100 THEN
      RAISE EXCEPTION 'DISCOUNT_PERCENT_OUT_OF_RANGE' USING ERRCODE = '22023';
    END IF;
    v_discount_per_member := round(v_gross_per_member * COALESCE(p_discount_value,0) / 100.0, 2);
  ELSE
    IF p_discount_value < 0 OR p_discount_value > v_gross_per_member * v_member_count THEN
      RAISE EXCEPTION 'DISCOUNT_FIXED_OUT_OF_RANGE' USING ERRCODE = '22023';
    END IF;
    v_discount_per_member := round(COALESCE(p_discount_value,0) / v_member_count, 2);
  END IF;
  v_discount_per_member := GREATEST(0, LEAST(v_discount_per_member, v_gross_per_member));

  -- ---------- Create group ----------
  INSERT INTO public.member_groups (branch_id, group_name, group_type, discount_type, discount_value, notes, created_by)
  VALUES (p_branch_id, p_group_name, p_group_type, p_discount_type, COALESCE(p_discount_value,0), p_notes, p_received_by)
  RETURNING id INTO v_group_id;

  FOREACH v_member_id IN ARRAY p_member_ids LOOP
    INSERT INTO public.member_group_members (group_id, member_id, role)
    VALUES (v_group_id, v_member_id, 'member')
    ON CONFLICT DO NOTHING;

    v_idempotency_key := format('group_purchase:%s:%s:%s', v_group_id, v_member_id, p_plan_id);

    v_purchase_result := public.purchase_member_membership(
      p_member_id => v_member_id, p_plan_id => p_plan_id, p_branch_id => p_branch_id,
      p_start_date => p_start_date, p_discount_amount => v_discount_per_member,
      p_discount_reason => format('Group: %s (%s)', p_group_name, p_group_type),
      p_include_gst => p_include_gst, p_gst_rate => COALESCE(v_plan.gst_rate, 0),
      p_payment_method => p_payment_method, p_amount_paying => 0,
      p_payment_due_date => p_start_date + INTERVAL '7 days',
      p_send_reminders => true, p_payment_source => 'manual',
      p_idempotency_key => v_idempotency_key, p_assign_locker_id => NULL,
      p_notes => p_notes, p_received_by => p_received_by
    );

    v_results := v_results || jsonb_build_array(jsonb_build_object('member_id', v_member_id, 'result', v_purchase_result));
  END LOOP;

  -- ---------- Audit ----------
  INSERT INTO public.audit_logs (branch_id, user_id, action, table_name, record_id, new_data)
  VALUES (
    p_branch_id, COALESCE(p_received_by, auth.uid()),
    'group_membership_purchased', 'member_groups', v_group_id,
    jsonb_build_object(
      'group_name', p_group_name, 'group_type', p_group_type,
      'plan_id', p_plan_id, 'member_count', v_member_count,
      'discount_type', p_discount_type, 'discount_value', p_discount_value,
      'discount_per_member', v_discount_per_member,
      'discount_total', v_discount_per_member * v_member_count,
      'gross_total', v_gross_per_member * v_member_count,
      'net_total', (v_gross_per_member - v_discount_per_member) * v_member_count,
      'member_ids', to_jsonb(p_member_ids)
    )
  );

  -- ---------- Award bonus ----------
  BEGIN
    v_bonus_result := public.award_group_bonus(v_group_id);
  EXCEPTION WHEN OTHERS THEN
    v_bonus_result := jsonb_build_object('success', false, 'error', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'success', true, 'group_id', v_group_id, 'group_name', p_group_name,
    'member_count', v_member_count,
    'discount_per_member', v_discount_per_member,
    'discount_total', v_discount_per_member * v_member_count,
    'purchases', v_results,
    'group_bonus', v_bonus_result
  );
END $$;

-- =============================================
-- PHASE 1: Marketing — Segments + Recipients
-- =============================================

CREATE TABLE IF NOT EXISTS public.contact_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  audience_count int NOT NULL DEFAULT 0,
  last_refreshed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contact_segments_branch ON public.contact_segments(branch_id);

ALTER TABLE public.contact_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "segments_staff_all" ON public.contact_segments;
CREATE POLICY "segments_staff_all" ON public.contact_segments
  TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role,'staff'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role,'staff'::app_role]));

CREATE TRIGGER update_contact_segments_updated_at BEFORE UPDATE ON public.contact_segments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Per-recipient delivery log for campaigns (replaces opaque counters)
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('member','lead','contact')),
  source_ref_id uuid NOT NULL,
  full_name text,
  phone text,
  email text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','suppressed','skipped')),
  error text,
  dispatched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id, status);

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campaign_recipients_staff" ON public.campaign_recipients;
CREATE POLICY "campaign_recipients_staff" ON public.campaign_recipients
  TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role,'staff'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role,'staff'::app_role]));

-- ---------- Unified audience resolver ----------
CREATE OR REPLACE FUNCTION public.resolve_campaign_audience(p_branch_id uuid, p_filter jsonb)
RETURNS TABLE(
  source_type text, source_ref_id uuid,
  full_name text, phone text, email text, contact_id uuid
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kind text := COALESCE(p_filter->>'audience_kind', 'members');
  v_status text := COALESCE(p_filter->>'member_status', 'all');
  v_categories text[];
  v_source_types text[];
  v_tags text[];
  v_lead_status text[];
  v_today date := CURRENT_DATE;
BEGIN
  v_categories := COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_filter->'categories')), '{}');
  v_source_types := COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_filter->'source_types')), '{}');
  v_tags := COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_filter->'tags')), '{}');
  v_lead_status := COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_filter->'lead_status')), '{}');

  IF v_kind IN ('segment') AND (p_filter->>'segment_id') IS NOT NULL THEN
    -- A saved segment is just a stored filter — recurse on it
    RETURN QUERY
      SELECT * FROM public.resolve_campaign_audience(
        p_branch_id,
        (SELECT filter FROM public.contact_segments WHERE id = (p_filter->>'segment_id')::uuid)
      );
    RETURN;
  END IF;

  IF v_kind IN ('members','mixed') THEN
    RETURN QUERY
      SELECT 'member'::text, m.id, p.full_name, p.phone, p.email, c.id
      FROM public.members m
      JOIN public.profiles p ON p.id = m.user_id
      LEFT JOIN public.contacts c ON c.source_type='member' AND c.source_id=m.id
      WHERE m.branch_id = p_branch_id
        AND (v_status='all'
             OR (v_status='active'  AND EXISTS (SELECT 1 FROM public.memberships ms WHERE ms.member_id=m.id AND ms.status='active' AND ms.end_date >= v_today))
             OR (v_status='expired' AND EXISTS (SELECT 1 FROM public.memberships ms WHERE ms.member_id=m.id AND ms.end_date <  v_today)));
  END IF;

  IF v_kind IN ('leads','mixed') THEN
    RETURN QUERY
      SELECT 'lead'::text, l.id, l.full_name, l.phone, l.email, c.id
      FROM public.leads l
      LEFT JOIN public.contacts c ON c.source_type='lead' AND c.source_id=l.id
      WHERE l.branch_id = p_branch_id
        AND (cardinality(v_lead_status)=0 OR l.status = ANY(v_lead_status));
  END IF;

  IF v_kind IN ('contacts','mixed') THEN
    RETURN QUERY
      SELECT 'contact'::text, c.id, c.full_name, c.phone, c.email, c.id
      FROM public.contacts c
      WHERE c.branch_id = p_branch_id
        AND (cardinality(v_categories)=0 OR c.category = ANY(v_categories))
        AND (cardinality(v_source_types)=0 OR c.source_type = ANY(v_source_types))
        AND (cardinality(v_tags)=0 OR c.tags && v_tags);
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.resolve_campaign_audience(uuid, jsonb) TO authenticated;

-- =============================================
-- PHASE 2: Announcement multi-channel fields
-- =============================================
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS channels text[] NOT NULL DEFAULT ARRAY['inapp']::text[],
  ADD COLUMN IF NOT EXISTS audience_filter jsonb NOT NULL DEFAULT '{"audience_kind":"members","member_status":"all"}'::jsonb,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_summary jsonb;

CREATE OR REPLACE FUNCTION public.promote_announcement_to_campaign(p_announcement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_a public.announcements%ROWTYPE;
  v_ch text;
  v_campaign_id uuid;
  v_ids uuid[] := '{}';
BEGIN
  SELECT * INTO v_a FROM public.announcements WHERE id = p_announcement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ANNOUNCEMENT_NOT_FOUND'; END IF;

  FOREACH v_ch IN ARRAY v_a.channels LOOP
    IF v_ch = 'inapp' THEN CONTINUE; END IF;
    INSERT INTO public.campaigns (
      branch_id, name, channel, audience_filter, message, subject,
      trigger_type, status, created_by
    ) VALUES (
      v_a.branch_id, '[Announcement] '||v_a.title, v_ch,
      v_a.audience_filter, v_a.content, v_a.title,
      'send_now', 'draft', auth.uid()
    ) RETURNING id INTO v_campaign_id;
    v_ids := v_ids || v_campaign_id;
  END LOOP;

  UPDATE public.announcements
  SET dispatched_at = now(),
      dispatch_summary = jsonb_build_object('campaign_ids', to_jsonb(v_ids), 'channels', to_jsonb(v_a.channels))
  WHERE id = p_announcement_id;

  RETURN jsonb_build_object('success', true, 'campaign_ids', to_jsonb(v_ids));
END $$;

GRANT EXECUTE ON FUNCTION public.promote_announcement_to_campaign(uuid) TO authenticated;
