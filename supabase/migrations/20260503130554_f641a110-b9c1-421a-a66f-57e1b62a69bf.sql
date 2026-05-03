-- 1) Capability registry
INSERT INTO public.role_capabilities (role, capability)
SELECT r, 'credit_member'
FROM (VALUES ('owner'::app_role), ('admin'::app_role), ('manager'::app_role)) AS t(r)
ON CONFLICT DO NOTHING;

-- 2) Atomic credit RPC
CREATE OR REPLACE FUNCTION public.credit_member(
  p_member_id uuid,
  p_branch_id uuid,
  p_wallet_amount numeric DEFAULT 0,
  p_reward_points integer DEFAULT 0,
  p_reason text DEFAULT 'Manual credit',
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_wallet_id uuid;
  v_current_balance numeric := 0;
  v_current_credited numeric := 0;
  v_new_balance numeric := 0;
  v_current_points integer := 0;
  v_existing jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_capability(v_user, 'credit_member') THEN
    RAISE EXCEPTION 'Insufficient privileges to credit member' USING ERRCODE = '42501';
  END IF;

  IF p_member_id IS NULL THEN
    RAISE EXCEPTION 'member_id is required';
  END IF;

  IF COALESCE(p_wallet_amount, 0) < 0 OR COALESCE(p_reward_points, 0) < 0 THEN
    RAISE EXCEPTION 'Amounts must be non-negative';
  END IF;

  IF COALESCE(p_wallet_amount, 0) = 0 AND COALESCE(p_reward_points, 0) = 0 THEN
    RAISE EXCEPTION 'Provide a wallet amount or reward points';
  END IF;

  -- Idempotency: if same key already used, return prior result
  IF p_idempotency_key IS NOT NULL THEN
    SELECT jsonb_build_object('idempotent', true, 'wallet_txn_id', id::text)
      INTO v_existing
      FROM public.wallet_transactions
      WHERE reference_type = 'manual_credit'
        AND description = p_idempotency_key
      LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  -- Wallet credit
  IF COALESCE(p_wallet_amount, 0) > 0 THEN
    SELECT id, balance, COALESCE(total_credited, 0)
      INTO v_wallet_id, v_current_balance, v_current_credited
      FROM public.wallets
      WHERE member_id = p_member_id
      FOR UPDATE;

    IF v_wallet_id IS NULL THEN
      INSERT INTO public.wallets (member_id, balance, total_credited, total_debited)
      VALUES (p_member_id, 0, 0, 0)
      RETURNING id, balance, COALESCE(total_credited, 0)
      INTO v_wallet_id, v_current_balance, v_current_credited;
    END IF;

    v_new_balance := v_current_balance + p_wallet_amount;

    INSERT INTO public.wallet_transactions
      (wallet_id, txn_type, amount, balance_after, description, reference_type, reference_id, created_by)
    VALUES
      (v_wallet_id, 'credit', p_wallet_amount, v_new_balance,
       COALESCE(p_idempotency_key, p_reason),
       'manual_credit', NULL, v_user);

    UPDATE public.wallets
       SET balance = v_new_balance,
           total_credited = v_current_credited + p_wallet_amount,
           updated_at = now()
     WHERE id = v_wallet_id;
  END IF;

  -- Reward points
  IF COALESCE(p_reward_points, 0) > 0 THEN
    INSERT INTO public.rewards_ledger
      (member_id, branch_id, points, reason, reference_type, created_by)
    VALUES
      (p_member_id, p_branch_id, p_reward_points, p_reason, 'manual_credit', v_user);

    SELECT COALESCE(reward_points, 0) INTO v_current_points
      FROM public.members WHERE id = p_member_id FOR UPDATE;

    UPDATE public.members
       SET reward_points = v_current_points + p_reward_points,
           updated_at = now()
     WHERE id = p_member_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'wallet_balance', v_new_balance,
    'wallet_credited', COALESCE(p_wallet_amount, 0),
    'points_credited', COALESCE(p_reward_points, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.credit_member(uuid, uuid, numeric, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_member(uuid, uuid, numeric, integer, text, text) TO authenticated;