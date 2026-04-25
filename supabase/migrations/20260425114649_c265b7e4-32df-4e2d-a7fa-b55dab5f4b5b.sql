-- =====================================================================
-- POS Checkout consolidation — atomic create_pos_sale RPC
-- Routes wallet & remainder portions through settle_payment for full
-- lifecycle, idempotency, and audit consistency.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.create_pos_sale(
  p_branch_id uuid,
  p_member_id uuid,
  p_items jsonb,                       -- [{product_id, name, quantity, unit_price, total}, ...]
  p_payment_method text,               -- 'cash' | 'card' | 'upi' | 'wallet'
  p_sold_by uuid,
  p_guest_name text DEFAULT NULL,
  p_guest_phone text DEFAULT NULL,
  p_guest_email text DEFAULT NULL,
  p_awaiting_payment boolean DEFAULT false,
  p_discount_amount numeric DEFAULT 0,
  p_discount_code_id uuid DEFAULT NULL,
  p_discount_code text DEFAULT NULL,
  p_wallet_applied numeric DEFAULT 0,
  p_transaction_id text DEFAULT NULL,
  p_slip_url text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal numeric := 0;
  v_total numeric;
  v_discount numeric := COALESCE(p_discount_amount, 0);
  v_wallet_applied numeric := COALESCE(p_wallet_applied, 0);
  v_remainder numeric;
  v_is_awaiting boolean := COALESCE(p_awaiting_payment, false);
  v_customer_name text := NULLIF(TRIM(COALESCE(p_guest_name, '')), '');
  v_customer_phone text := NULLIF(TRIM(COALESCE(p_guest_phone, '')), '');
  v_customer_email text := NULLIF(TRIM(COALESCE(p_guest_email, '')), '');
  v_pos_sale_id uuid;
  v_invoice_id uuid;
  v_wallet_row record;
  v_code_row record;
  v_today date := CURRENT_DATE;
  v_item jsonb;
  v_inv_qty integer;
  v_inv_id uuid;
  v_member_profile record;
  v_note_parts text[] := ARRAY[]::text[];
  v_notes text;
  v_settle_resp jsonb;
BEGIN
  -- ── 1. Compute subtotal from items ─────────────────────────────────
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal + COALESCE((v_item->>'total')::numeric, 0);
  END LOOP;

  v_discount := GREATEST(0, LEAST(v_discount, v_subtotal));
  v_total := GREATEST(0, v_subtotal - v_discount);

  -- Wallet split is incompatible with awaiting-payment (link) flows
  IF v_is_awaiting THEN
    v_wallet_applied := 0;
    v_remainder := v_total;
  ELSE
    v_wallet_applied := GREATEST(0, LEAST(v_wallet_applied, v_total));
    v_remainder := GREATEST(0, v_total - v_wallet_applied);
  END IF;

  -- ── 2. Pre-flight: wallet sufficiency (lock the wallet row) ────────
  IF v_wallet_applied > 0 THEN
    IF p_member_id IS NULL THEN
      RAISE EXCEPTION 'Wallet redemption requires a member';
    END IF;
    SELECT id, balance INTO v_wallet_row
    FROM wallets WHERE member_id = p_member_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Member wallet not found';
    END IF;
    IF (COALESCE(v_wallet_row.balance, 0))::numeric < v_wallet_applied THEN
      RAISE EXCEPTION 'Insufficient wallet balance';
    END IF;
  END IF;

  -- ── 3. Pre-flight: coupon validation (lock the code row) ───────────
  IF NOT v_is_awaiting AND p_discount_code_id IS NOT NULL AND v_discount > 0 THEN
    SELECT id, is_active, valid_from, valid_until, max_uses, times_used, branch_id, min_purchase
    INTO v_code_row
    FROM discount_codes WHERE id = p_discount_code_id
    FOR UPDATE;
    IF NOT FOUND OR NOT v_code_row.is_active THEN
      RAISE EXCEPTION 'Coupon is no longer valid';
    END IF;
    IF v_code_row.valid_from IS NOT NULL AND v_code_row.valid_from > v_today THEN
      RAISE EXCEPTION 'Coupon is not yet valid';
    END IF;
    IF v_code_row.valid_until IS NOT NULL AND v_code_row.valid_until < v_today THEN
      RAISE EXCEPTION 'Coupon has expired';
    END IF;
    IF v_code_row.max_uses IS NOT NULL AND COALESCE(v_code_row.times_used, 0) >= v_code_row.max_uses THEN
      RAISE EXCEPTION 'Coupon usage limit reached';
    END IF;
    IF v_code_row.branch_id IS NOT NULL AND v_code_row.branch_id <> p_branch_id THEN
      RAISE EXCEPTION 'Coupon is not valid at this branch';
    END IF;
    IF v_code_row.min_purchase IS NOT NULL AND v_subtotal < v_code_row.min_purchase THEN
      RAISE EXCEPTION 'Coupon minimum purchase not met';
    END IF;
  END IF;

  -- ── 4. Resolve customer snapshot from member if not provided ───────
  IF p_member_id IS NOT NULL AND v_customer_name IS NULL THEN
    SELECT p.full_name, p.phone, p.email
      INTO v_member_profile
    FROM members m
    LEFT JOIN profiles p ON p.id = m.user_id
    WHERE m.id = p_member_id;
    IF FOUND THEN
      v_customer_name := COALESCE(v_customer_name, v_member_profile.full_name);
      v_customer_phone := COALESCE(v_customer_phone, v_member_profile.phone);
      v_customer_email := COALESCE(v_customer_email, v_member_profile.email);
    END IF;
  END IF;

  -- ── 5. Compose notes ───────────────────────────────────────────────
  v_note_parts := array_append(v_note_parts,
    CASE WHEN v_is_awaiting THEN 'POS Sale — Awaiting Payment Link' ELSE 'POS Sale' END);
  IF p_discount_code IS NOT NULL AND v_discount > 0 THEN
    v_note_parts := array_append(v_note_parts,
      'Coupon ' || p_discount_code || ': -₹' || to_char(v_discount, 'FM999999990.00'));
  END IF;
  IF v_wallet_applied > 0 THEN
    v_note_parts := array_append(v_note_parts,
      'Wallet applied: ₹' || to_char(v_wallet_applied, 'FM999999990.00'));
  END IF;
  v_notes := array_to_string(v_note_parts, ' | ');

  -- ── 6. Create POS sale row ─────────────────────────────────────────
  INSERT INTO pos_sales (
    branch_id, member_id, items, total_amount, payment_method, sold_by,
    customer_name, customer_phone, customer_email, payment_status
  ) VALUES (
    p_branch_id, p_member_id, p_items, v_total, p_payment_method::payment_method, p_sold_by,
    v_customer_name, v_customer_phone, v_customer_email,
    CASE WHEN v_is_awaiting THEN 'awaiting_payment' ELSE 'paid' END
  ) RETURNING id INTO v_pos_sale_id;

  -- ── 7. Create invoice + items ──────────────────────────────────────
  INSERT INTO invoices (
    branch_id, member_id, invoice_number, subtotal, discount_amount,
    total_amount, amount_paid, status, due_date, pos_sale_id, source, notes
  ) VALUES (
    p_branch_id, p_member_id, NULL,
    v_subtotal,
    NULLIF(v_discount, 0),
    v_total,
    CASE WHEN v_is_awaiting THEN 0 ELSE v_total END,
    CASE WHEN v_is_awaiting THEN 'pending'::invoice_status ELSE 'paid'::invoice_status END,
    v_today,
    v_pos_sale_id,
    'pos'::invoice_source,
    v_notes
  ) RETURNING id INTO v_invoice_id;

  UPDATE pos_sales SET invoice_id = v_invoice_id WHERE id = v_pos_sale_id;

  INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_amount, reference_type, reference_id)
  SELECT v_invoice_id,
         it->>'name',
         COALESCE((it->>'quantity')::integer, 1),
         COALESCE((it->>'unit_price')::numeric, 0),
         COALESCE((it->>'total')::numeric, 0),
         'product',
         NULLIF(it->>'product_id','')::uuid
  FROM jsonb_array_elements(p_items) AS it;

  -- ── 8. Settle payments via authoritative settle_payment RPC ────────
  IF NOT v_is_awaiting THEN
    -- Wallet portion
    IF v_wallet_applied > 0 THEN
      v_settle_resp := settle_payment(
        p_branch_id        := p_branch_id,
        p_invoice_id       := v_invoice_id,
        p_member_id        := p_member_id,
        p_amount           := v_wallet_applied,
        p_payment_method   := 'wallet',
        p_transaction_id   := NULL,
        p_notes            := 'Wallet redemption (POS)',
        p_received_by      := p_sold_by,
        p_income_category_id := NULL,
        p_payment_source   := 'pos_sale',
        p_idempotency_key  := COALESCE(p_idempotency_key, v_pos_sale_id::text) || ':wallet',
        p_gateway_payment_id := NULL,
        p_payment_transaction_id := NULL,
        p_metadata         := jsonb_build_object('pos_sale_id', v_pos_sale_id)
      );
    END IF;

    -- Remainder portion (cash/card/upi)
    IF v_remainder > 0 THEN
      v_settle_resp := settle_payment(
        p_branch_id        := p_branch_id,
        p_invoice_id       := v_invoice_id,
        p_member_id        := p_member_id,
        p_amount           := v_remainder,
        p_payment_method   := p_payment_method,
        p_transaction_id   := p_transaction_id,
        p_notes            := v_notes,
        p_received_by      := p_sold_by,
        p_income_category_id := NULL,
        p_payment_source   := 'pos_sale',
        p_idempotency_key  := COALESCE(p_idempotency_key, v_pos_sale_id::text) || ':remainder',
        p_gateway_payment_id := NULL,
        p_payment_transaction_id := NULL,
        p_metadata         := jsonb_build_object('pos_sale_id', v_pos_sale_id, 'slip_url', p_slip_url)
      );
    END IF;
  END IF;

  -- ── 9. Increment coupon usage (we already locked the row) ──────────
  IF NOT v_is_awaiting AND p_discount_code_id IS NOT NULL AND v_discount > 0 AND v_code_row.id IS NOT NULL THEN
    UPDATE discount_codes
       SET times_used = COALESCE(times_used, 0) + 1
     WHERE id = p_discount_code_id;
  END IF;

  -- ── 10. Decrement inventory ────────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT id, quantity INTO v_inv_id, v_inv_qty
      FROM inventory
     WHERE product_id = NULLIF(v_item->>'product_id','')::uuid
       AND branch_id = p_branch_id
     FOR UPDATE;
    IF FOUND THEN
      UPDATE inventory
         SET quantity = GREATEST(0, COALESCE(v_inv_qty,0) - COALESCE((v_item->>'quantity')::integer, 0))
       WHERE id = v_inv_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'pos_sale_id', v_pos_sale_id,
    'invoice_id', v_invoice_id,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'wallet_applied', v_wallet_applied,
    'remainder', v_remainder,
    'total', v_total,
    'awaiting', v_is_awaiting
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_pos_sale(
  uuid, uuid, jsonb, text, uuid, text, text, text, boolean, numeric, uuid, text, numeric, text, text, text
) TO authenticated;