-- Phase 1: Duration-Linked Benefits
-- Add 'per_membership' to frequency_type enum
ALTER TYPE frequency_type ADD VALUE IF NOT EXISTS 'per_membership';

-- Phase 2: Smart Locker Management  
-- Add locker inclusion fields to membership_plans
ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS includes_free_locker BOOLEAN DEFAULT false;
ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS free_locker_size TEXT;

-- Phase 3: Stock Movements Table
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL,
  branch_id UUID REFERENCES branches(id) NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('stock_in', 'sale', 'adjustment', 'return', 'initial')),
  quantity INTEGER NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on stock_movements
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS policies for stock_movements
CREATE POLICY "Staff can view stock movements" ON stock_movements
  FOR SELECT USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[])
  );

CREATE POLICY "Staff can insert stock movements" ON stock_movements
  FOR INSERT WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[])
  );

-- Phase 4: Feedback Google Integration
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS is_approved_for_google BOOLEAN DEFAULT false;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS google_review_id TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS published_to_google_at TIMESTAMPTZ;

-- Create index for stock movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_branch ON stock_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);