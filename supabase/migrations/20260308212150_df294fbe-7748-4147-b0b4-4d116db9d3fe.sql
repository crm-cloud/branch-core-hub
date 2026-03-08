
-- Create income_categories table mirroring expense_categories
CREATE TABLE public.income_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.income_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read income categories"
  ON public.income_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff and above can manage income categories"
  ON public.income_categories FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'staff', 'manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'staff', 'manager']::app_role[]));

-- Add income_category_id to payments table
ALTER TABLE public.payments ADD COLUMN income_category_id UUID REFERENCES public.income_categories(id);

-- Seed default income categories
INSERT INTO public.income_categories (name, description, is_system) VALUES
  ('Membership Fees', 'Revenue from membership plan purchases and renewals', true),
  ('PT Packages', 'Personal training package sales', true),
  ('Class Fees', 'Group class and workshop fees', true),
  ('Store / POS Sales', 'Product sales from store and point of sale', true),
  ('Registration / Joining Fee', 'One-time joining or registration fees', true),
  ('Locker Rental', 'Locker rental income', true),
  ('Add-on Services', 'Additional services like spa, sauna, etc.', true),
  ('Referral Income', 'Revenue from referral program rewards', true),
  ('Other Income', 'Miscellaneous income', true);

-- Seed default expense categories (only if table is empty)
INSERT INTO public.expense_categories (name, description, is_active)
SELECT name, description, true FROM (VALUES
  ('Rent & Lease', 'Monthly rent and lease payments'),
  ('Salaries & Wages', 'Employee and staff salaries'),
  ('Utilities', 'Electricity, water, internet bills'),
  ('Equipment Purchase', 'New gym equipment purchases'),
  ('Equipment Maintenance', 'Repairs and servicing of equipment'),
  ('Marketing & Advertising', 'Ads, promotions, social media'),
  ('Cleaning & Housekeeping', 'Cleaning supplies and services'),
  ('Insurance', 'Business and liability insurance'),
  ('Trainer Commissions', 'PT trainer commission payouts'),
  ('Software & Subscriptions', 'Software licenses and SaaS tools'),
  ('Office Supplies', 'Stationery and office materials'),
  ('Repairs & Maintenance', 'Building and facility repairs'),
  ('Miscellaneous', 'Other uncategorized expenses')
) AS defaults(name, description)
WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories LIMIT 1);
