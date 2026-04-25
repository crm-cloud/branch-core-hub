-- 1. notified_at column for dedup
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_notified_at ON public.leads (notified_at) WHERE notified_at IS NULL;

-- 2. pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 3. Private schema for trigger config (service-role key only readable by SECURITY DEFINER funcs)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.trigger_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE private.trigger_config FROM PUBLIC, anon, authenticated;

-- Seed the project URL (the service-role key is inserted via the data tool in a separate step)
INSERT INTO private.trigger_config (key, value)
VALUES ('supabase_url', 'https://iyqqpbvnszyrrgerniog.supabase.co')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 4. Trigger function: fire notify-lead-created via pg_net (async, non-blocking)
CREATE OR REPLACE FUNCTION public.fn_notify_lead_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
  v_supabase_url text;
  v_service_key text;
  v_request_id bigint;
BEGIN
  IF NEW.notified_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.branch_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_supabase_url FROM private.trigger_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_key  FROM private.trigger_config WHERE key = 'service_role_key';

  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    RAISE NOTICE 'fn_notify_lead_created: trigger_config missing url/key, skipping for lead %', NEW.id;
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/notify-lead-created',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
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

-- 5. Wire the trigger
DROP TRIGGER IF EXISTS trg_on_lead_inserted ON public.leads;
CREATE TRIGGER trg_on_lead_inserted
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_lead_created();