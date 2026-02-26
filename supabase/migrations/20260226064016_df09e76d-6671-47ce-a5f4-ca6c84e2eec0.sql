-- Add public read policy for organization_settings so public website can load theme
CREATE POLICY "Public can read org settings"
  ON public.organization_settings
  FOR SELECT
  TO anon
  USING (true);
