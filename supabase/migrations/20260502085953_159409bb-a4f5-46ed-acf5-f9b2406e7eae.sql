-- =====================================================================
-- Branch-scoping helpers (defense in depth) + RPC documentation.
-- =====================================================================

-- 1. current_branch(): resolve the active branch for the current request.
--    Order of precedence:
--      a) JWT claim `branch_id` (set by client via setBranchContext header)
--      b) GUC `app.current_branch` (settable inside SECURITY DEFINER RPCs
--         or via SET LOCAL in scripts/edge functions)
--      c) NULL (caller has no active branch context)
CREATE OR REPLACE FUNCTION public.current_branch()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claim text;
  v_guc   text;
BEGIN
  BEGIN
    v_claim := current_setting('request.jwt.claims', true)::jsonb ->> 'branch_id';
  EXCEPTION WHEN others THEN
    v_claim := NULL;
  END;
  IF v_claim IS NOT NULL AND length(v_claim) >= 32 THEN
    RETURN v_claim::uuid;
  END IF;

  BEGIN
    v_guc := current_setting('app.current_branch', true);
  EXCEPTION WHEN others THEN
    v_guc := NULL;
  END;
  IF v_guc IS NOT NULL AND length(v_guc) >= 32 THEN
    RETURN v_guc::uuid;
  END IF;

  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.current_branch() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_branch() TO authenticated, service_role;

-- 2. is_branch_member(branch_id): true if the current user has access to
--    the given branch. Owner/admin have access to all.
CREATE OR REPLACE FUNCTION public.is_branch_member(p_branch_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;
  IF p_branch_id IS NULL THEN
    RETURN false;
  END IF;

  -- Owners and admins are branch-agnostic.
  IF has_role(v_uid, 'owner'::app_role) OR has_role(v_uid, 'admin'::app_role) THEN
    RETURN true;
  END IF;

  -- Staff/managers/trainers: lookup via staff_branches if present.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='staff_branches'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM staff_branches sb
      WHERE sb.user_id = v_uid AND sb.branch_id = p_branch_id
    ) THEN
      RETURN true;
    END IF;
  END IF;

  -- Members: their own branch via members.user_id.
  IF EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = v_uid AND m.branch_id = p_branch_id
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.is_branch_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_branch_member(uuid) TO authenticated, service_role;

-- 3. enforce_branch_match: convenience guard for RPCs.
CREATE OR REPLACE FUNCTION public.enforce_branch_match(p_branch_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'BRANCH_REQUIRED: branch_id is required'
      USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.is_branch_member(p_branch_id) THEN
    RAISE EXCEPTION 'BRANCH_DENIED: user lacks access to branch %', p_branch_id
      USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_branch_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_branch_match(uuid) TO authenticated, service_role;

-- 4. Document the two remaining purchase_pt_package overloads so the
--    boundary is preserved.
COMMENT ON FUNCTION public.purchase_pt_package(
  p_member_id uuid, p_package_id uuid, p_branch_id uuid,
  p_trainer_id uuid, p_payment_source text, p_idempotency_key text
) IS
  'MEMBER SELF-CHECKOUT path. Creates a pending invoice + payment link (no immediate settlement). Use the 8-arg `_*` overload for staff-driven immediate settlement.';

COMMENT ON FUNCTION public.purchase_pt_package(
  _member_id uuid, _package_id uuid, _trainer_id uuid, _branch_id uuid,
  _price_paid numeric, _payment_method text, _idempotency_key text, _received_by uuid
) IS
  'STAFF IMMEDIATE SETTLEMENT path. Routes through record_payment with explicit method + idempotency key. Use the 6-arg `p_*` overload for member self-checkout.';