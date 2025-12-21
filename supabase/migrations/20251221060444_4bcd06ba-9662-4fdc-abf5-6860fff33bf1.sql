-- Integration settings for Payment Gateways, SMS, Email, WhatsApp
CREATE TABLE public.integration_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL, -- 'payment_gateway', 'sms', 'email', 'whatsapp'
  provider TEXT NOT NULL, -- 'razorpay', 'phonepe', 'ccavenue', 'payu', 'msg91', 'gupshup', etc.
  is_active BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  credentials JSONB DEFAULT '{}', -- encrypted/masked credentials
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(branch_id, integration_type, provider)
);

-- WhatsApp Chat Messages
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  message_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'image', 'document', 'template'
  content TEXT,
  media_url TEXT,
  direction TEXT NOT NULL, -- 'inbound', 'outbound'
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'read', 'failed'
  whatsapp_message_id TEXT,
  sent_by UUID, -- staff who sent it
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Payment Gateway Transactions with Webhook Data
CREATE TABLE public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  gateway TEXT NOT NULL, -- 'razorpay', 'phonepe', 'ccavenue', 'payu'
  gateway_order_id TEXT,
  gateway_payment_id TEXT,
  gateway_signature TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created', -- 'created', 'authorized', 'captured', 'failed', 'refunded'
  webhook_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for integration_settings (admin only)
CREATE POLICY "Admins can manage integration settings"
ON public.integration_settings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin')
  )
);

-- RLS Policies for whatsapp_messages (staff with access)
CREATE POLICY "Staff can view whatsapp messages for their branches"
ON public.whatsapp_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    LEFT JOIN public.branch_managers bm ON bm.user_id = ur.user_id
    WHERE ur.user_id = auth.uid() 
    AND (
      ur.role IN ('owner', 'admin') 
      OR (ur.role = 'manager' AND bm.branch_id = branch_id)
    )
  )
);

CREATE POLICY "Staff can insert whatsapp messages"
ON public.whatsapp_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin', 'manager', 'staff')
  )
);

CREATE POLICY "Staff can update whatsapp messages"
ON public.whatsapp_messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin', 'manager', 'staff')
  )
);

-- RLS Policies for payment_transactions
CREATE POLICY "Staff can view payment transactions"
ON public.payment_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin', 'manager', 'staff')
  )
);

CREATE POLICY "Staff can insert payment transactions"
ON public.payment_transactions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin', 'manager', 'staff')
  )
);

CREATE POLICY "Staff can update payment transactions"
ON public.payment_transactions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin', 'manager')
  )
);

-- Create indexes
CREATE INDEX idx_integration_settings_branch ON public.integration_settings(branch_id);
CREATE INDEX idx_integration_settings_type ON public.integration_settings(integration_type);
CREATE INDEX idx_whatsapp_messages_branch ON public.whatsapp_messages(branch_id);
CREATE INDEX idx_whatsapp_messages_phone ON public.whatsapp_messages(phone_number);
CREATE INDEX idx_whatsapp_messages_created ON public.whatsapp_messages(created_at DESC);
CREATE INDEX idx_payment_transactions_branch ON public.payment_transactions(branch_id);
CREATE INDEX idx_payment_transactions_invoice ON public.payment_transactions(invoice_id);
CREATE INDEX idx_payment_transactions_gateway_order ON public.payment_transactions(gateway_order_id);