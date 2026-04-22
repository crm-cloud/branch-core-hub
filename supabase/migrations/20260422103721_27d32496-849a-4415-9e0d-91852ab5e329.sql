CREATE OR REPLACE FUNCTION public.audit_log_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  branch_val uuid;
  actor_name_val text;
  action_desc text;
  record_pk uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    branch_val := NULL;
  ELSE
    branch_val := COALESCE(NEW.branch_id, OLD.branch_id);
  END IF;

  record_pk := COALESCE(NEW.id, OLD.id);

  INSERT INTO public.audit_logs (
    action,
    table_name,
    record_id,
    old_data,
    user_id,
    branch_id,
    actor_name,
    action_description
  )
  VALUES (
    TG_OP,
    TG_TABLE_NAME,
    record_pk,
    to_jsonb(OLD),
    auth.uid(),
    branch_val,
    actor_name_val,
    action_desc
  );

  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_logs_branch_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.branch_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.branches WHERE id = NEW.branch_id
    ) THEN
      NEW.branch_id := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.touch_meal_catalog_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $function$;