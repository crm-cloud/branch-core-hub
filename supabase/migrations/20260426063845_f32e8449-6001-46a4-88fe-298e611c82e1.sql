DROP POLICY IF EXISTS "System can insert booking audit" ON public.booking_audit_log;
-- No INSERT policy: only the SECURITY DEFINER trigger fn_booking_status_audit writes here.
-- It runs as table owner and bypasses RLS, so this is sufficient and safe.
