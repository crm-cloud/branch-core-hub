-- 1) Storage bucket for plan PDF attachments (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('plan-attachments', 'plan-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for plan-attachments bucket
DO $$
BEGIN
  -- Staff/trainers/owners/admins/managers can upload + read
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Staff can read plan attachments'
  ) THEN
    CREATE POLICY "Staff can read plan attachments"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'plan-attachments'
        AND (
          public.has_role(auth.uid(), 'owner')
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'manager')
          OR public.has_role(auth.uid(), 'staff')
          OR public.has_role(auth.uid(), 'trainer')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Staff can upload plan attachments'
  ) THEN
    CREATE POLICY "Staff can upload plan attachments"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'plan-attachments'
        AND (
          public.has_role(auth.uid(), 'owner')
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'manager')
          OR public.has_role(auth.uid(), 'staff')
          OR public.has_role(auth.uid(), 'trainer')
        )
      );
  END IF;

  -- Members read their own files (filename starts with member_id/...)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Members can read own plan attachments'
  ) THEN
    CREATE POLICY "Members can read own plan attachments"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'plan-attachments'
        AND EXISTS (
          SELECT 1 FROM public.members m
          WHERE m.user_id = auth.uid()
            AND (storage.foldername(name))[1] = m.id::text
        )
      );
  END IF;
END $$;

-- 2) Mark legacy fitness tables as deprecated (visible in DB GUIs)
COMMENT ON TABLE public.diet_plans       IS 'DEPRECATED — superseded by member_fitness_plans. Read-only fallback retained in MyDiet for legacy data.';
COMMENT ON TABLE public.workout_plans    IS 'DEPRECATED — superseded by member_fitness_plans.';
COMMENT ON TABLE public.diet_templates   IS 'DEPRECATED — superseded by fitness_plan_templates.';
COMMENT ON TABLE public.workout_templates IS 'DEPRECATED — superseded by fitness_plan_templates.';