-- Add capacity column to branches
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS capacity integer DEFAULT 50;

-- Update audit_log_trigger_function to also check locker_number, employee_code, code
CREATE OR REPLACE FUNCTION public.audit_log_trigger_function()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  record_pk uuid;
  branch_val uuid;
  actor_name_val text;
  action_desc text;
  record_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    record_pk := OLD.id;
  ELSE
    record_pk := NEW.id;
  END IF;
  
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

  SELECT full_name INTO actor_name_val 
  FROM public.profiles 
  WHERE id = auth.uid();
  
  IF actor_name_val IS NULL THEN
    actor_name_val := 'System';
  END IF;

  record_name := NULL;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      IF to_jsonb(OLD) ? 'name' THEN record_name := OLD.name::text;
      ELSIF to_jsonb(OLD) ? 'full_name' THEN record_name := OLD.full_name::text;
      ELSIF to_jsonb(OLD) ? 'member_code' THEN record_name := OLD.member_code::text;
      ELSIF to_jsonb(OLD) ? 'invoice_number' THEN record_name := OLD.invoice_number::text;
      ELSIF to_jsonb(OLD) ? 'title' THEN record_name := OLD.title::text;
      ELSIF to_jsonb(OLD) ? 'locker_number' THEN record_name := 'Locker #' || OLD.locker_number::text;
      ELSIF to_jsonb(OLD) ? 'employee_code' THEN record_name := OLD.employee_code::text;
      ELSIF to_jsonb(OLD) ? 'code' THEN record_name := OLD.code::text;
      ELSIF to_jsonb(OLD) ? 'device_name' THEN record_name := OLD.device_name::text;
      END IF;
    ELSE
      IF to_jsonb(NEW) ? 'name' THEN record_name := NEW.name::text;
      ELSIF to_jsonb(NEW) ? 'full_name' THEN record_name := NEW.full_name::text;
      ELSIF to_jsonb(NEW) ? 'member_code' THEN record_name := NEW.member_code::text;
      ELSIF to_jsonb(NEW) ? 'invoice_number' THEN record_name := NEW.invoice_number::text;
      ELSIF to_jsonb(NEW) ? 'title' THEN record_name := NEW.title::text;
      ELSIF to_jsonb(NEW) ? 'locker_number' THEN record_name := 'Locker #' || NEW.locker_number::text;
      ELSIF to_jsonb(NEW) ? 'employee_code' THEN record_name := NEW.employee_code::text;
      ELSIF to_jsonb(NEW) ? 'code' THEN record_name := NEW.code::text;
      ELSIF to_jsonb(NEW) ? 'device_name' THEN record_name := NEW.device_name::text;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  IF record_name IS NULL THEN
    record_name := TG_TABLE_NAME || ' record';
  END IF;

  action_desc := actor_name_val || ' ' || 
    CASE TG_OP
      WHEN 'INSERT' THEN 'created'
      WHEN 'UPDATE' THEN 'updated'
      WHEN 'DELETE' THEN 'deleted'
      ELSE TG_OP
    END || ' ' || TG_TABLE_NAME || ' "' || COALESCE(SUBSTRING(record_name, 1, 50), 'record') || '"';

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      action, table_name, record_id, new_data, user_id, branch_id, actor_name, action_description
    ) VALUES (
      'INSERT', TG_TABLE_NAME, record_pk, 
      to_jsonb(NEW), 
      auth.uid(),
      branch_val,
      actor_name_val,
      action_desc
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (
      action, table_name, record_id, old_data, new_data, user_id, branch_id, actor_name, action_description
    ) VALUES (
      'UPDATE', TG_TABLE_NAME, record_pk, 
      to_jsonb(OLD), to_jsonb(NEW), 
      auth.uid(),
      branch_val,
      actor_name_val,
      action_desc
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (
      action, table_name, record_id, old_data, user_id, branch_id, actor_name, action_description
    ) VALUES (
      'DELETE', TG_TABLE_NAME, record_pk, 
      to_jsonb(OLD), 
      auth.uid(),
      branch_val,
      actor_name_val,
      action_desc
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;