
-- 1) Templates: first-class attachment support
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS header_type text DEFAULT 'none' CHECK (header_type IN ('none','image','document','video')),
  ADD COLUMN IF NOT EXISTS header_media_url text,
  ADD COLUMN IF NOT EXISTS header_media_handle text,
  ADD COLUMN IF NOT EXISTS attachment_source text DEFAULT 'none' CHECK (attachment_source IN ('none','static','dynamic')),
  ADD COLUMN IF NOT EXISTS attachment_filename_template text;

-- 2) Benefit packages: HSN + GST tax fields
ALTER TABLE public.benefit_packages
  ADD COLUMN IF NOT EXISTS hsn_code text,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_inclusive boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS gst_category text NOT NULL DEFAULT 'services' CHECK (gst_category IN ('goods','services'));

-- 3) Storage bucket for template media (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('template-media', 'template-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: admins/owners/managers can manage; everyone can read (public bucket for WhatsApp delivery)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='template_media_public_read') THEN
    CREATE POLICY "template_media_public_read" ON storage.objects
      FOR SELECT USING (bucket_id = 'template-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='template_media_admin_write') THEN
    CREATE POLICY "template_media_admin_write" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'template-media' AND public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role]));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='template_media_admin_update') THEN
    CREATE POLICY "template_media_admin_update" ON storage.objects
      FOR UPDATE USING (bucket_id = 'template-media' AND public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role]));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='template_media_admin_delete') THEN
    CREATE POLICY "template_media_admin_delete" ON storage.objects
      FOR DELETE USING (bucket_id = 'template-media' AND public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role]));
  END IF;
END $$;
