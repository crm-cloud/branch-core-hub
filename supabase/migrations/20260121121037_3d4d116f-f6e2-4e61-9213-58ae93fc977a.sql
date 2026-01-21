-- Issue 3: Add benefit_type_id column to plan_benefits
ALTER TABLE plan_benefits 
ADD COLUMN IF NOT EXISTS benefit_type_id UUID REFERENCES benefit_types(id);

-- Create index for foreign key
CREATE INDEX IF NOT EXISTS idx_plan_benefits_benefit_type_id 
ON plan_benefits(benefit_type_id);

-- Issue 4: Add partial payment support to invoices
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS payment_due_date DATE,
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_reminder_at TIMESTAMPTZ;

-- Create payment_reminders table for tracking scheduled reminders
CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) NOT NULL,
  invoice_id UUID REFERENCES invoices(id) NOT NULL,
  member_id UUID REFERENCES members(id) NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('due_soon', 'on_due', 'overdue', 'final_notice')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on payment_reminders
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment_reminders
CREATE POLICY "Staff can view payment reminders" ON payment_reminders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Staff can create payment reminders" ON payment_reminders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Staff can update payment reminders" ON payment_reminders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
    )
  );