DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'approval_requests',
    'staff_attendance',
    'feedback',
    'class_bookings',
    'benefit_bookings',
    'pt_sessions',
    'classes',
    'class_waitlist',
    'products',
    'inventory',
    'pos_sales',
    'expenses',
    'expense_categories',
    'payments',
    'payment_transactions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      -- REPLICA IDENTITY FULL so payloads include the full row
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      -- Add to publication if not already a member
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END IF;
  END LOOP;
END $$;