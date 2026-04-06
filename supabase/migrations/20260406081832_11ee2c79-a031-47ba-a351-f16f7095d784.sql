
-- ============================================================
-- 1. record_payment RPC — single source of truth for payments
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_payment(
  p_branch_id uuid,
  p_invoice_id uuid,
  p_member_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_transaction_id text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_received_by uuid DEFAULT NULL,
  p_income_category_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice RECORD;
  v_payment_id uuid;
  v_new_amount_paid numeric;
  v_new_status text;
  v_wallet RECORD;
  v_new_balance numeric;
BEGIN
  -- 1. Validate invoice exists
  SELECT id, total_amount, amount_paid, status, branch_id
  INTO v_invoice
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF v_invoice.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot pay a cancelled invoice');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- 2. Handle wallet payment: validate and debit
  IF p_payment_method = 'wallet' THEN
    SELECT id, balance, total_credited, total_debited
    INTO v_wallet
    FROM wallets
    WHERE member_id = p_member_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    IF v_wallet.balance < p_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient wallet balance');
    END IF;

    v_new_balance := v_wallet.balance - p_amount;

    -- Create wallet transaction
    INSERT INTO wallet_transactions (wallet_id, txn_type, amount, balance_after, description, reference_type, reference_id, created_by)
    VALUES (v_wallet.id, 'debit', p_amount, v_new_balance, 'Payment for invoice', 'invoice', p_invoice_id::text, p_received_by);

    -- Update wallet balance
    UPDATE wallets
    SET balance = v_new_balance,
        total_debited = COALESCE(total_debited, 0) + p_amount
    WHERE id = v_wallet.id;
  END IF;

  -- 3. Insert payment record
  INSERT INTO payments (
    branch_id, invoice_id, member_id, amount, payment_method,
    transaction_id, notes, received_by, status, income_category_id
  ) VALUES (
    p_branch_id, p_invoice_id, p_member_id, p_amount, p_payment_method,
    p_transaction_id, p_notes, p_received_by, 'completed', p_income_category_id
  )
  RETURNING id INTO v_payment_id;

  -- 4. Update invoice balance
  v_new_amount_paid := COALESCE(v_invoice.amount_paid, 0) + p_amount;
  IF v_new_amount_paid >= v_invoice.total_amount THEN
    v_new_status := 'paid';
  ELSIF v_new_amount_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'pending';
  END IF;

  UPDATE invoices
  SET amount_paid = v_new_amount_paid,
      status = v_new_status
  WHERE id = p_invoice_id;

  -- 5. If fully paid, activate linked memberships
  IF v_new_status = 'paid' THEN
    UPDATE memberships
    SET status = 'active'
    WHERE id IN (
      SELECT reference_id::uuid
      FROM invoice_items
      WHERE invoice_id = p_invoice_id
        AND reference_type = 'membership'
        AND reference_id IS NOT NULL
    )
    AND status IN ('pending', 'inactive');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'new_amount_paid', v_new_amount_paid,
    'new_status', v_new_status
  );
END;
$$;

-- ============================================================
-- 2. void_payment RPC — atomically void and reverse
-- ============================================================
CREATE OR REPLACE FUNCTION public.void_payment(
  p_payment_id uuid,
  p_reason text DEFAULT 'Voided by admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment RECORD;
  v_invoice RECORD;
  v_new_amount_paid numeric;
  v_new_status text;
  v_wallet RECORD;
  v_new_balance numeric;
BEGIN
  -- 1. Lock and validate payment
  SELECT id, invoice_id, member_id, amount, payment_method, status
  INTO v_payment
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  IF v_payment.status = 'voided' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment already voided');
  END IF;

  -- 2. Void the payment
  UPDATE payments
  SET status = 'voided', notes = COALESCE(notes || ' | ', '') || 'VOID: ' || p_reason
  WHERE id = p_payment_id;

  -- 3. Reverse invoice balance
  IF v_payment.invoice_id IS NOT NULL THEN
    SELECT id, total_amount, amount_paid
    INTO v_invoice
    FROM invoices
    WHERE id = v_payment.invoice_id
    FOR UPDATE;

    IF FOUND THEN
      v_new_amount_paid := GREATEST(0, COALESCE(v_invoice.amount_paid, 0) - v_payment.amount);
      IF v_new_amount_paid >= v_invoice.total_amount THEN
        v_new_status := 'paid';
      ELSIF v_new_amount_paid > 0 THEN
        v_new_status := 'partial';
      ELSE
        v_new_status := 'pending';
      END IF;

      UPDATE invoices
      SET amount_paid = v_new_amount_paid,
          status = v_new_status
      WHERE id = v_payment.invoice_id;
    END IF;
  END IF;

  -- 4. Refund wallet if it was a wallet payment
  IF v_payment.payment_method = 'wallet' AND v_payment.member_id IS NOT NULL THEN
    SELECT id, balance, total_credited
    INTO v_wallet
    FROM wallets
    WHERE member_id = v_payment.member_id
    FOR UPDATE;

    IF FOUND THEN
      v_new_balance := v_wallet.balance + v_payment.amount;

      INSERT INTO wallet_transactions (wallet_id, txn_type, amount, balance_after, description, reference_type, reference_id)
      VALUES (v_wallet.id, 'credit', v_payment.amount, v_new_balance, 'Refund: payment voided', 'payment_void', p_payment_id::text);

      UPDATE wallets
      SET balance = v_new_balance,
          total_credited = COALESCE(total_credited, 0) + v_payment.amount
      WHERE id = v_wallet.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'voided_amount', v_payment.amount,
    'invoice_new_status', v_new_status
  );
END;
$$;

-- ============================================================
-- 3. reminder_configurations table
-- ============================================================
CREATE TABLE public.reminder_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  reminder_type text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  days_before integer[] DEFAULT ARRAY[7, 3, 1],
  channel text NOT NULL DEFAULT 'notification',
  template_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(branch_id, reminder_type)
);

ALTER TABLE public.reminder_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view reminder configs"
  ON public.reminder_configurations FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
  );

CREATE POLICY "Admins can manage reminder configs"
  ON public.reminder_configurations FOR ALL
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[])
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[])
  );

CREATE TRIGGER update_reminder_configurations_updated_at
  BEFORE UPDATE ON public.reminder_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
