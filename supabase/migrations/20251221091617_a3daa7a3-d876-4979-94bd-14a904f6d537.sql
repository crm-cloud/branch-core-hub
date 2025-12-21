-- Create product_categories table
CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  parent_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add category_id to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.product_categories(id);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'reminder')),
  category TEXT,
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create notification_preferences table
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_membership_reminders BOOLEAN DEFAULT true,
  email_payment_receipts BOOLEAN DEFAULT true,
  email_class_notifications BOOLEAN DEFAULT true,
  email_announcements BOOLEAN DEFAULT true,
  push_low_stock BOOLEAN DEFAULT true,
  push_new_leads BOOLEAN DEFAULT true,
  push_payment_alerts BOOLEAN DEFAULT true,
  push_task_reminders BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add reward_mode to referral_settings
ALTER TABLE public.referral_settings ADD COLUMN IF NOT EXISTS reward_mode TEXT DEFAULT 'fixed' CHECK (reward_mode IN ('fixed', 'percentage'));

-- Add pos_sale_id to invoices for linking
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS pos_sale_id UUID REFERENCES public.pos_sales(id);

-- Enable RLS on new tables
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_categories (readable by authenticated users, writable by admins)
CREATE POLICY "Product categories are viewable by authenticated users"
ON public.product_categories FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Product categories are manageable by staff"
ON public.product_categories FOR ALL
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager']::app_role[]));

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Staff can create notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

-- RLS policies for notification_preferences
CREATE POLICY "Users can view their own preferences"
ON public.notification_preferences FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own preferences"
ON public.notification_preferences FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for product images
CREATE POLICY "Product images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'products');

CREATE POLICY "Staff can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'products' AND public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

CREATE POLICY "Staff can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'products' AND public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

CREATE POLICY "Staff can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'products' AND public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[]));

-- Triggers for updated_at
CREATE TRIGGER update_product_categories_updated_at
BEFORE UPDATE ON public.product_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();