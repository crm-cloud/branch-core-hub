
-- 1. Add hsn_code to invoice_items
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS hsn_code TEXT;

-- 2. Add hsn_defaults to organization_settings
ALTER TABLE public.organization_settings ADD COLUMN IF NOT EXISTS hsn_defaults JSONB DEFAULT '{}';

-- 3. Create org-assets storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('org-assets', 'org-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage policies for org-assets
CREATE POLICY "Public read access for org-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'org-assets');

CREATE POLICY "Staff can upload org-assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'org-assets'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Staff can update org-assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'org-assets'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Staff can delete org-assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'org-assets'
  AND auth.role() = 'authenticated'
);

-- 5. Delete policy for error_logs (so Clear Resolved button works)
CREATE POLICY "Authenticated users can delete resolved error logs"
ON public.error_logs FOR DELETE
USING (
  auth.role() = 'authenticated'
  AND status = 'resolved'
);
