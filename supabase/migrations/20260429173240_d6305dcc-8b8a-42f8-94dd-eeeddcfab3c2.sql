-- Add richer fields to error_logs for edge function reporting
ALTER TABLE public.error_logs
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'error',
  ADD COLUMN IF NOT EXISTS context jsonb,
  ADD COLUMN IF NOT EXISTS branch_id uuid;

CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_branch ON public.error_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON public.error_logs(created_at DESC);

-- Enable realtime for live System Health updates (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'error_logs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.error_logs';
  END IF;
END $$;

ALTER TABLE public.error_logs REPLICA IDENTITY FULL;