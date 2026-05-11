CREATE OR REPLACE FUNCTION public.audit_log_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_branch       uuid;
  v_record_pk    uuid;
  v_uid          uuid;
  v_actor_name   text;
  v_action_desc  text;
  v_old_data     jsonb;
  v_new_data     jsonb;
  v_table_label  text;
BEGIN
  v_uid := auth.uid();

  -- Resolve actor name with safe fallbacks
  BEGIN
    v_actor_name := NULLIF(current_setting('app.actor_name', true), '');
  EXCEPTION WHEN OTHERS THEN
    v_actor_name := NULL;
  END;

  IF v_actor_name IS NULL AND v_uid IS NOT NULL THEN
    BEGIN
      SELECT NULLIF(full_name, '') INTO v_actor_name
      FROM public.profiles WHERE id = v_uid;
    EXCEPTION WHEN OTHERS THEN
      v_actor_name := NULL;
    END;
  END IF;

  IF v_actor_name IS NULL AND v_uid IS NOT NULL THEN
    BEGIN
      SELECT email INTO v_actor_name
      FROM auth.users WHERE id = v_uid;
    EXCEPTION WHEN OTHERS THEN
      v_actor_name := NULL;
    END;
  END IF;

  -- Snapshots, branch, pk
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
  ELSE -- DELETE
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_branch   := OLD.branch_id;
    v_record_pk := OLD.id;
  END IF;

  v_table_label := replace(TG_TABLE_NAME, '_', ' ');
  v_action_desc := CASE TG_OP
    WHEN 'INSERT' THEN 'Created ' || v_table_label || ' row'
    WHEN 'UPDATE' THEN 'Updated ' || v_table_label || ' row'
    WHEN 'DELETE' THEN 'Deleted ' || v_table_label || ' row'
    ELSE TG_OP || ' ' || v_table_label
  END;

  INSERT INTO public.audit_logs (
    action, table_name, record_id,
    old_data, new_data,
    user_id, branch_id,
    actor_name, action_description
  ) VALUES (
    TG_OP, TG_TABLE_NAME, v_record_pk,
    v_old_data, v_new_data,
    v_uid, v_branch,
    v_actor_name, v_action_desc
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;