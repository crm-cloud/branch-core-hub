
-- 1. Product flags
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS requires_batch_tracking boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_lab_report boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_shelf_life_days integer;

-- 2. product_batches
CREATE TABLE IF NOT EXISTS public.product_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  batch_number text NOT NULL,
  mfg_date date,
  exp_date date,
  quantity_received integer NOT NULL CHECK (quantity_received >= 0),
  quantity_remaining integer NOT NULL CHECK (quantity_remaining >= 0),
  cost_price numeric(10,2),
  supplier text,
  invoice_ref text,
  lab_report_url text,
  lab_report_filename text,
  lab_report_uploaded_at timestamptz,
  lab_verified boolean NOT NULL DEFAULT false,
  lab_verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','depleted','expired','recalled','quarantined')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, branch_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_product_batches_fefo
  ON public.product_batches (product_id, branch_id, status, exp_date);
CREATE INDEX IF NOT EXISTS idx_product_batches_branch
  ON public.product_batches (branch_id);

ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_product_batches" ON public.product_batches;
CREATE POLICY "view_product_batches"
  ON public.product_batches FOR SELECT
  TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role,'staff'::app_role]));

DROP POLICY IF EXISTS "manage_product_batches" ON public.product_batches;
CREATE POLICY "manage_product_batches"
  ON public.product_batches FOR ALL
  TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]));

DROP TRIGGER IF EXISTS update_product_batches_updated_at ON public.product_batches;
CREATE TRIGGER update_product_batches_updated_at
  BEFORE UPDATE ON public.product_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto flip to depleted
CREATE OR REPLACE FUNCTION public.product_batches_auto_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.quantity_remaining = 0 AND NEW.status = 'active' THEN
    NEW.status := 'depleted';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_batches_auto_status ON public.product_batches;
CREATE TRIGGER trg_product_batches_auto_status
  BEFORE INSERT OR UPDATE ON public.product_batches
  FOR EACH ROW EXECUTE FUNCTION public.product_batches_auto_status();

-- 3. stock_movements.batch_id
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.product_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_batch
  ON public.stock_movements (batch_id);

-- 4. Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-lab-reports', 'product-lab-reports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "lab_reports_view" ON storage.objects;
CREATE POLICY "lab_reports_view"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-lab-reports'
         AND has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role,'staff'::app_role]));

DROP POLICY IF EXISTS "lab_reports_upload" ON storage.objects;
CREATE POLICY "lab_reports_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-lab-reports'
              AND has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]));

DROP POLICY IF EXISTS "lab_reports_update" ON storage.objects;
CREATE POLICY "lab_reports_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-lab-reports'
         AND has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]));

DROP POLICY IF EXISTS "lab_reports_delete" ON storage.objects;
CREATE POLICY "lab_reports_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-lab-reports'
         AND has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]));
