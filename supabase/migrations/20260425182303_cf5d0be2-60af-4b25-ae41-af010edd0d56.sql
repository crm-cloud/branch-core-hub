-- Recreate trigger function to call notify-lead-created without auth header
-- (notify-lead-created is now public via verify_jwt=false; it validates payload itself)
CREATE OR REPLACE FUNCTION public.fn_notify_lead_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
  v_supabase_url text;
  v_request_id bigint;
BEGIN
  IF NEW.notified_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.branch_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_supabase_url FROM private.trigger_config WHERE key = 'supabase_url';
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://iyqqpbvnszyrrgerniog.supabase.co';
  END IF;

  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/notify-lead-created',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'lead_id', NEW.id,
      'branch_id', NEW.branch_id
    ),
    timeout_milliseconds := 5000
  ) INTO v_request_id;

  RAISE NOTICE 'fn_notify_lead_created: dispatched request % for lead %', v_request_id, NEW.id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_notify_lead_created failed for lead %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;