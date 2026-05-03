-- Allow staff/owner roles to upload to shared attachment folders (invoices,
-- receipts, plans, scans, reports, shared). Member-owned uploads (folder = uid)
-- still go through the existing "Attachments owner can write" policy.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Staff can write shared attachments'
  ) THEN
    CREATE POLICY "Staff can write shared attachments"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'attachments'
        AND (storage.foldername(name))[1] IN (
          'invoices','receipts','plans','shared','scans','reports','whatsapp-attachments'
        )
        AND (
          public.has_role(auth.uid(),'owner')
          OR public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'manager')
          OR public.has_role(auth.uid(),'staff')
          OR public.has_role(auth.uid(),'trainer')
        )
      );
  END IF;
END $$;