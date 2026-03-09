
CREATE OR REPLACE FUNCTION public.auto_disable_hardware_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Disable hardware access when member is suspended or blacklisted
  IF NEW.status IN ('suspended', 'blacklisted') AND OLD.status = 'active' THEN
    NEW.hardware_access_enabled := false;
  END IF;
  -- Re-enable hardware access when member becomes active again
  IF NEW.status = 'active' AND OLD.status IN ('inactive', 'suspended', 'blacklisted') THEN
    NEW.hardware_access_enabled := true;
  END IF;
  RETURN NEW;
END;
$function$;
