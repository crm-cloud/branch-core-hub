ALTER TABLE public.pos_sales
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid';

CREATE INDEX IF NOT EXISTS idx_pos_sales_payment_status ON public.pos_sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_pos_sales_customer_phone ON public.pos_sales(customer_phone);