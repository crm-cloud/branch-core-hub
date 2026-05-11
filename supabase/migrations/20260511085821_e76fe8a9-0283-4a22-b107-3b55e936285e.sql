-- =========================================================
-- 1) Add target_name column + index
-- =========================================================
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS target_name text;

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_target
  ON public.audit_logs (table_name, target_name);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_name
  ON public.audit_logs (actor_name);

-- =========================================================
-- 2) Helper: resolve a human-readable target label per table
--    Pure function over jsonb + small profile lookups.
-- =========================================================
CREATE OR REPLACE FUNCTION public._resolve_audit_target_name(
  p_table text,
  p_row   jsonb
) RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text;
  v_uid  uuid;
BEGIN
  IF p_row IS NULL THEN RETURN NULL; END IF;

  CASE p_table
    WHEN 'members' THEN
      v_uid := NULLIF(p_row->>'user_id','')::uuid;
      IF v_uid IS NOT NULL THEN
        SELECT NULLIF(full_name,'') INTO v_name FROM public.profiles WHERE id = v_uid;
      END IF;
      RETURN COALESCE(v_name, p_row->>'member_code');

    WHEN 'employees' THEN
      v_uid := NULLIF(p_row->>'user_id','')::uuid;
      IF v_uid IS NOT NULL THEN
        SELECT NULLIF(full_name,'') INTO v_name FROM public.profiles WHERE id = v_uid;
      END IF;
      RETURN COALESCE(v_name, p_row->>'employee_code');

    WHEN 'trainers' THEN
      v_uid := NULLIF(p_row->>'user_id','')::uuid;
      IF v_uid IS NOT NULL THEN
        SELECT NULLIF(full_name,'') INTO v_name FROM public.profiles WHERE id = v_uid;
      END IF;
      RETURN v_name;

    WHEN 'leads'           THEN RETURN p_row->>'full_name';
    WHEN 'invoices'        THEN RETURN p_row->>'invoice_number';
    WHEN 'payments'        THEN RETURN COALESCE(p_row->>'reference_id', '₹' || (p_row->>'amount'));
    WHEN 'memberships' THEN
      v_uid := NULLIF(p_row->>'member_id','')::uuid;
      IF v_uid IS NOT NULL THEN
        SELECT COALESCE(NULLIF(p.full_name,''), m.member_code)
          INTO v_name
          FROM public.members m LEFT JOIN public.profiles p ON p.id = m.user_id
          WHERE m.id = v_uid;
      END IF;
      RETURN v_name;
    WHEN 'lockers'              THEN RETURN p_row->>'locker_number';
    WHEN 'classes'              THEN RETURN p_row->>'name';
    WHEN 'tasks'                THEN RETURN p_row->>'title';
    WHEN 'equipment'            THEN RETURN COALESCE(p_row->>'name', p_row->>'serial_number');
    WHEN 'equipment_maintenance' THEN RETURN p_row->>'maintenance_type';
    WHEN 'member_comps'         THEN RETURN p_row->>'reason';
    WHEN 'lead_followups'       THEN RETURN p_row->>'outcome';
    WHEN 'benefit_bookings'     THEN RETURN p_row->>'status';
    WHEN 'class_bookings'       THEN RETURN p_row->>'status';
    WHEN 'contracts'            THEN RETURN p_row->>'contract_type';
    WHEN 'member_documents'     THEN RETURN COALESCE(p_row->>'file_name', p_row->>'document_type');
    WHEN 'staff_attendance'     THEN RETURN NULL;
    WHEN 'pt_packages'          THEN RETURN p_row->>'name';
    WHEN 'pt_sessions'          THEN RETURN p_row->>'status';
    WHEN 'member_pt_packages'   THEN RETURN p_row->>'status';
    WHEN 'products'             THEN RETURN p_row->>'name';
    WHEN 'expenses'             THEN RETURN COALESCE(p_row->>'description', '₹' || (p_row->>'amount'));
    WHEN 'wallet_transactions'  THEN RETURN COALESCE(p_row->>'description', p_row->>'reference_id');
    WHEN 'referrals'            THEN RETURN p_row->>'status';
    WHEN 'announcements'        THEN RETURN p_row->>'title';
    WHEN 'campaigns'            THEN RETURN p_row->>'name';
    WHEN 'coupon_redemptions'   THEN RETURN p_row->>'idempotency_key';
    WHEN 'membership_plans'     THEN RETURN p_row->>'name';
    WHEN 'branches'             THEN RETURN p_row->>'name';
    WHEN 'user_roles'           THEN RETURN p_row->>'role';
    WHEN 'integration_settings' THEN RETURN p_row->>'provider';
    ELSE
      RETURN COALESCE(p_row->>'name', p_row->>'title', p_row->>'label', p_row->>'code');
  END CASE;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- =========================================================
-- 3) Enhance audit trigger to populate target_name + better description
-- =========================================================
CREATE OR REPLACE FUNCTION public.audit_log_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_branch       uuid;
  v_record_pk    uuid;
  v_uid          uuid;
  v_actor_name   text;
  v_action_desc  text;
  v_old_data     jsonb;
  v_new_data     jsonb;
  v_target_name  text;
  v_table_label  text;
  v_action_verb  text;
BEGIN
  v_uid := auth.uid();

  BEGIN
    v_actor_name := NULLIF(current_setting('app.actor_name', true), '');
  EXCEPTION WHEN OTHERS THEN v_actor_name := NULL; END;

  IF v_actor_name IS NULL AND v_uid IS NOT NULL THEN
    BEGIN
      SELECT NULLIF(full_name,'') INTO v_actor_name FROM public.profiles WHERE id = v_uid;
    EXCEPTION WHEN OTHERS THEN v_actor_name := NULL; END;
  END IF;

  IF v_actor_name IS NULL AND v_uid IS NOT NULL THEN
    BEGIN
      SELECT email INTO v_actor_name FROM auth.users WHERE id = v_uid;
    EXCEPTION WHEN OTHERS THEN v_actor_name := NULL; END;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
    v_branch   := NEW.branch_id;
    v_record_pk := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_branch   := COALESCE(NEW.branch_id, OLD.branch_id);
    v_record_pk := COALESCE(NEW.id, OLD.id);
  ELSE
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_branch   := OLD.branch_id;
    v_record_pk := OLD.id;
  END IF;

  v_target_name := public._resolve_audit_target_name(TG_TABLE_NAME, COALESCE(v_new_data, v_old_data));

  v_table_label := replace(TG_TABLE_NAME, '_', ' ');
  v_action_verb := CASE TG_OP WHEN 'INSERT' THEN 'Created' WHEN 'UPDATE' THEN 'Updated' WHEN 'DELETE' THEN 'Deleted' ELSE TG_OP END;
  v_action_desc := v_action_verb || ' ' || v_table_label
                   || CASE WHEN v_target_name IS NOT NULL THEN ' — ' || v_target_name ELSE '' END;

  INSERT INTO public.audit_logs (
    action, table_name, record_id,
    old_data, new_data,
    user_id, branch_id,
    actor_name, action_description, target_name
  ) VALUES (
    TG_OP, TG_TABLE_NAME, v_record_pk,
    v_old_data, v_new_data,
    v_uid, v_branch,
    v_actor_name, v_action_desc, v_target_name
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- =========================================================
-- 4) Branch-guard (some tables don't have branch_id) — wrap a no-branch
--    variant that won't reference NEW.branch_id when missing.
--    Safer approach: create a polymorphic helper that tries to read
--    branch_id from the row jsonb instead of the record.
-- =========================================================
CREATE OR REPLACE FUNCTION public.audit_log_trigger_function_nb()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_record_pk    uuid;
  v_uid          uuid;
  v_actor_name   text;
  v_action_desc  text;
  v_old_data     jsonb;
  v_new_data     jsonb;
  v_target_name  text;
  v_branch       uuid;
  v_table_label  text;
  v_action_verb  text;
BEGIN
  v_uid := auth.uid();

  BEGIN v_actor_name := NULLIF(current_setting('app.actor_name', true), '');
  EXCEPTION WHEN OTHERS THEN v_actor_name := NULL; END;

  IF v_actor_name IS NULL AND v_uid IS NOT NULL THEN
    BEGIN SELECT NULLIF(full_name,'') INTO v_actor_name FROM public.profiles WHERE id = v_uid;
    EXCEPTION WHEN OTHERS THEN v_actor_name := NULL; END;
  END IF;

  IF v_actor_name IS NULL AND v_uid IS NOT NULL THEN
    BEGIN SELECT email INTO v_actor_name FROM auth.users WHERE id = v_uid;
    EXCEPTION WHEN OTHERS THEN v_actor_name := NULL; END;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_old_data := NULL;     v_new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD); v_new_data := to_jsonb(NEW);
  ELSE
    v_old_data := to_jsonb(OLD); v_new_data := NULL;
  END IF;

  v_record_pk := COALESCE(v_new_data->>'id', v_old_data->>'id')::uuid;
  v_branch := NULLIF(COALESCE(v_new_data->>'branch_id', v_old_data->>'branch_id'),'')::uuid;
  v_target_name := public._resolve_audit_target_name(TG_TABLE_NAME, COALESCE(v_new_data, v_old_data));

  v_table_label := replace(TG_TABLE_NAME, '_', ' ');
  v_action_verb := CASE TG_OP WHEN 'INSERT' THEN 'Created' WHEN 'UPDATE' THEN 'Updated' WHEN 'DELETE' THEN 'Deleted' ELSE TG_OP END;
  v_action_desc := v_action_verb || ' ' || v_table_label
                   || CASE WHEN v_target_name IS NOT NULL THEN ' — ' || v_target_name ELSE '' END;

  INSERT INTO public.audit_logs (
    action, table_name, record_id, old_data, new_data,
    user_id, branch_id, actor_name, action_description, target_name
  ) VALUES (
    TG_OP, TG_TABLE_NAME, v_record_pk, v_old_data, v_new_data,
    v_uid, v_branch, v_actor_name, v_action_desc, v_target_name
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- =========================================================
-- 5) Attach triggers to all target tables (idempotent)
--    Tables with branch_id -> use audit_log_trigger_function
--    Tables without -> use audit_log_trigger_function_nb
-- =========================================================

-- with branch_id
DO $$
DECLARE
  t text;
  with_branch text[] := ARRAY[
    'tasks','equipment','member_comps','contracts',
    'pt_packages','member_pt_packages','products','expenses',
    'announcements','campaigns','coupon_redemptions','membership_plans',
    'integration_settings','class_bookings'
  ];
  no_branch text[] := ARRAY[
    'equipment_maintenance','lead_followups','benefit_bookings',
    'member_documents','staff_attendance','pt_sessions',
    'wallet_transactions','referrals','user_roles','branches'
  ];
BEGIN
  FOREACH t IN ARRAY with_branch LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%s_trigger ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER audit_%s_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_function()',
      t, t
    );
  END LOOP;

  FOREACH t IN ARRAY no_branch LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%s_trigger ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER audit_%s_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_function_nb()',
      t, t
    );
  END LOOP;
END $$;

-- Replace old benefit_bookings status-only trigger
DROP TRIGGER IF EXISTS trg_booking_status_audit ON public.benefit_bookings;