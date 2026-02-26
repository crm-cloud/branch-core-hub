
-- Create error_logs table
CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  error_message text NOT NULL,
  stack_trace text,
  component_name text,
  route text,
  browser_info text,
  status text NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_error_log_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('open', 'resolved') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be open or resolved.', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_error_log_status
  BEFORE INSERT OR UPDATE ON public.error_logs
  FOR EACH ROW EXECUTE FUNCTION public.validate_error_log_status();

-- RLS: Any authenticated user can insert (for error boundary logging)
CREATE POLICY "Authenticated users can insert error logs"
  ON public.error_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- RLS: Only admin/owner can read
CREATE POLICY "Admins can read error logs"
  ON public.error_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- RLS: Only admin/owner can update (mark resolved)
CREATE POLICY "Admins can update error logs"
  ON public.error_logs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));
