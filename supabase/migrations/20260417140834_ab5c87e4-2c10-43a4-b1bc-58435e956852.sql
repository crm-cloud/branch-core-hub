-- Add invoice source classification
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS source TEXT;

-- Backfill from existing data patterns
UPDATE public.invoices
SET source = 'pos'
WHERE source IS NULL AND pos_sale_id IS NOT NULL;

UPDATE public.invoices
SET source = 'member_store'
WHERE source IS NULL
  AND notes IS NOT NULL
  AND notes ILIKE '%store purchase by member%';

UPDATE public.invoices
SET source = 'manual'
WHERE source IS NULL;

-- Set default for future rows
ALTER TABLE public.invoices
ALTER COLUMN source SET DEFAULT 'manual';

-- Index for Store filter
CREATE INDEX IF NOT EXISTS idx_invoices_source ON public.invoices(source);