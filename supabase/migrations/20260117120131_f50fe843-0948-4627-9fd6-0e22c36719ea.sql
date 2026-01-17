-- Fix audit_log_trigger_function to use UUID instead of TEXT for record_id
CREATE OR REPLACE FUNCTION public.audit_log_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  record_pk uuid;
  branch_val uuid;
BEGIN
  -- Get the record ID as UUID
  IF TG_OP = 'DELETE' THEN
    record_pk := OLD.id;
  ELSE
    record_pk := NEW.id;
  END IF;
  
  -- Get branch_id if available
  IF TG_OP = 'DELETE' THEN
    BEGIN
      branch_val := OLD.branch_id;
    EXCEPTION WHEN undefined_column THEN
      branch_val := NULL;
    END;
  ELSE
    BEGIN
      branch_val := NEW.branch_id;
    EXCEPTION WHEN undefined_column THEN
      branch_val := NULL;
    END;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      action, table_name, record_id, new_data, user_id, branch_id
    ) VALUES (
      'INSERT', TG_TABLE_NAME, record_pk, 
      to_jsonb(NEW), 
      auth.uid(),
      branch_val
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (
      action, table_name, record_id, old_data, new_data, user_id, branch_id
    ) VALUES (
      'UPDATE', TG_TABLE_NAME, record_pk, 
      to_jsonb(OLD), to_jsonb(NEW), 
      auth.uid(),
      branch_val
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (
      action, table_name, record_id, old_data, user_id, branch_id
    ) VALUES (
      'DELETE', TG_TABLE_NAME, record_pk, 
      to_jsonb(OLD), 
      auth.uid(),
      branch_val
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- Also fix log_audit_change function
CREATE OR REPLACE FUNCTION public.log_audit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  record_pk uuid;
  branch_val uuid;
BEGIN
  -- Get record ID
  IF TG_OP = 'DELETE' THEN
    record_pk := OLD.id;
  ELSE
    record_pk := NEW.id;
  END IF;
  
  -- Get branch_id if available
  IF TG_OP = 'DELETE' THEN
    BEGIN
      branch_val := OLD.branch_id;
    EXCEPTION WHEN undefined_column THEN
      branch_val := NULL;
    END;
  ELSE
    BEGIN
      branch_val := NEW.branch_id;
    EXCEPTION WHEN undefined_column THEN
      branch_val := NULL;
    END;
  END IF;

  INSERT INTO public.audit_logs (
    branch_id,
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) VALUES (
    branch_val,
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    record_pk,
    CASE 
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
      WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD)
      ELSE NULL
    END,
    CASE 
      WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW)
      ELSE NULL
    END
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;