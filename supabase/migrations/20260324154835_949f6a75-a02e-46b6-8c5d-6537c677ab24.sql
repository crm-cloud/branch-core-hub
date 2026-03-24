CREATE POLICY "Staff can view access logs"
ON public.access_logs FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));