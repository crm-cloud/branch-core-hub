-- =========================================================
-- Cmd+K Command Center: secure, role/branch-aware search RPCs
-- =========================================================

-- Helper: returns branch ids visible to a user based on their roles
CREATE OR REPLACE FUNCTION public.user_visible_branches(_uid uuid)
RETURNS TABLE(branch_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  -- Owner/Admin: all branches
  IF public.has_any_role(_uid, ARRAY['owner'::app_role, 'admin'::app_role]) THEN
    RETURN QUERY SELECT b.id FROM public.branches b;
    RETURN;
  END IF;

  -- Manager: assigned branches via staff_branches
  IF public.has_role(_uid, 'manager'::app_role) THEN
    RETURN QUERY
      SELECT sb.branch_id
      FROM public.staff_branches sb
      WHERE sb.user_id = _uid;
    RETURN;
  END IF;

  -- Staff: home branch via employees
  IF public.has_role(_uid, 'staff'::app_role) THEN
    RETURN QUERY
      SELECT e.branch_id
      FROM public.employees e
      WHERE e.user_id = _uid AND e.branch_id IS NOT NULL;
    RETURN;
  END IF;

  -- Trainer: home branch via trainers
  IF public.has_role(_uid, 'trainer'::app_role) THEN
    RETURN QUERY
      SELECT t.branch_id
      FROM public.trainers t
      WHERE t.user_id = _uid AND t.branch_id IS NOT NULL;
    RETURN;
  END IF;

  -- Member: home branch via members
  IF public.has_role(_uid, 'member'::app_role) THEN
    RETURN QUERY
      SELECT m.branch_id
      FROM public.members m
      WHERE m.user_id = _uid AND m.branch_id IS NOT NULL;
    RETURN;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_visible_branches(uuid) TO authenticated;

-- =========================================================
-- search_command_members
-- =========================================================
CREATE OR REPLACE FUNCTION public.search_command_members(
  search_term text,
  p_branch_id uuid DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  member_code text,
  full_name text,
  phone text,
  email text,
  status text,
  branch_id uuid,
  branch_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_term text := COALESCE(NULLIF(trim(search_term), ''), '');
BEGIN
  IF v_uid IS NULL OR length(v_term) < 1 THEN
    RETURN;
  END IF;

  -- Members do not get admin search
  IF public.has_role(v_uid, 'member'::app_role)
     AND NOT public.has_any_role(v_uid, ARRAY['owner','admin','manager','staff','trainer']::app_role[]) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT m.id,
         m.member_code,
         p.full_name,
         p.phone,
         p.email,
         m.status::text,
         m.branch_id,
         b.name AS branch_name
  FROM public.members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.branches b ON b.id = m.branch_id
  WHERE m.branch_id IN (SELECT branch_id FROM public.user_visible_branches(v_uid))
    AND (p_branch_id IS NULL OR m.branch_id = p_branch_id)
    AND (
      m.member_code ILIKE '%' || v_term || '%'
      OR p.full_name ILIKE '%' || v_term || '%'
      OR p.phone     ILIKE '%' || v_term || '%'
      OR p.email     ILIKE '%' || v_term || '%'
    )
    -- Trainer: restrict to assigned PT clients only
    AND (
      NOT public.has_role(v_uid, 'trainer'::app_role)
      OR public.has_any_role(v_uid, ARRAY['owner','admin','manager','staff']::app_role[])
      OR EXISTS (
        SELECT 1
        FROM public.member_pt_packages mpp
        JOIN public.trainers t ON t.id = mpp.trainer_id
        WHERE mpp.member_id = m.id AND t.user_id = v_uid
      )
    )
  ORDER BY p.full_name NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 25));
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_command_members(text, uuid, int) TO authenticated;

-- =========================================================
-- search_command_invoices
-- =========================================================
CREATE OR REPLACE FUNCTION public.search_command_invoices(
  search_term text,
  p_branch_id uuid DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  invoice_number text,
  status text,
  total_amount numeric,
  amount_paid numeric,
  member_id uuid,
  member_name text,
  branch_id uuid,
  branch_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_term text := COALESCE(NULLIF(trim(search_term), ''), '');
  v_member_only boolean := public.has_role(v_uid, 'member'::app_role)
                            AND NOT public.has_any_role(v_uid, ARRAY['owner','admin','manager','staff','trainer']::app_role[]);
BEGIN
  IF v_uid IS NULL OR length(v_term) < 1 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT i.id,
         i.invoice_number,
         i.status::text,
         i.total_amount,
         i.amount_paid,
         i.member_id,
         p.full_name AS member_name,
         i.branch_id,
         b.name AS branch_name
  FROM public.invoices i
  LEFT JOIN public.members m ON m.id = i.member_id
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.branches b ON b.id = i.branch_id
  WHERE (
          v_member_only
            AND m.user_id = v_uid
        )
        OR (
          NOT v_member_only
          AND i.branch_id IN (SELECT branch_id FROM public.user_visible_branches(v_uid))
          AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
        )
    AND (
      COALESCE(i.invoice_number, '') ILIKE '%' || v_term || '%'
      OR p.full_name ILIKE '%' || v_term || '%'
      OR m.member_code ILIKE '%' || v_term || '%'
    )
  ORDER BY i.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 25));
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_command_invoices(text, uuid, int) TO authenticated;

-- =========================================================
-- search_command_leads
-- =========================================================
CREATE OR REPLACE FUNCTION public.search_command_leads(
  search_term text,
  p_branch_id uuid DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  full_name text,
  phone text,
  email text,
  status text,
  temperature text,
  branch_id uuid,
  branch_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_term text := COALESCE(NULLIF(trim(search_term), ''), '');
BEGIN
  IF v_uid IS NULL OR length(v_term) < 1 THEN
    RETURN;
  END IF;

  -- Leads only for staff and above
  IF NOT public.has_any_role(v_uid, ARRAY['owner','admin','manager','staff']::app_role[]) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT l.id, l.full_name, l.phone, l.email,
         l.status::text, l.temperature,
         l.branch_id, b.name AS branch_name
  FROM public.leads l
  LEFT JOIN public.branches b ON b.id = l.branch_id
  WHERE l.branch_id IN (SELECT branch_id FROM public.user_visible_branches(v_uid))
    AND (p_branch_id IS NULL OR l.branch_id = p_branch_id)
    AND (
      l.full_name ILIKE '%' || v_term || '%'
      OR COALESCE(l.email,'') ILIKE '%' || v_term || '%'
      OR l.phone ILIKE '%' || v_term || '%'
    )
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 25));
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_command_leads(text, uuid, int) TO authenticated;

-- =========================================================
-- search_command_trainers
-- =========================================================
CREATE OR REPLACE FUNCTION public.search_command_trainers(
  search_term text,
  p_branch_id uuid DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  full_name text,
  phone text,
  email text,
  is_active boolean,
  branch_id uuid,
  branch_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_term text := COALESCE(NULLIF(trim(search_term), ''), '');
BEGIN
  IF v_uid IS NULL OR length(v_term) < 1 THEN
    RETURN;
  END IF;

  IF NOT public.has_any_role(v_uid, ARRAY['owner','admin','manager','staff','trainer']::app_role[]) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT t.id, p.full_name, p.phone, p.email, t.is_active,
         t.branch_id, b.name AS branch_name
  FROM public.trainers t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN public.branches b ON b.id = t.branch_id
  WHERE t.branch_id IN (SELECT branch_id FROM public.user_visible_branches(v_uid))
    AND (p_branch_id IS NULL OR t.branch_id = p_branch_id)
    AND (
      p.full_name ILIKE '%' || v_term || '%'
      OR COALESCE(p.email,'') ILIKE '%' || v_term || '%'
      OR COALESCE(p.phone,'') ILIKE '%' || v_term || '%'
    )
    -- Trainer role restricted to themselves
    AND (
      NOT public.has_role(v_uid, 'trainer'::app_role)
      OR public.has_any_role(v_uid, ARRAY['owner','admin','manager','staff']::app_role[])
      OR t.user_id = v_uid
    )
  ORDER BY p.full_name NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 25));
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_command_trainers(text, uuid, int) TO authenticated;

-- =========================================================
-- search_command_payments
-- =========================================================
CREATE OR REPLACE FUNCTION public.search_command_payments(
  search_term text,
  p_branch_id uuid DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  amount numeric,
  payment_method text,
  status text,
  payment_date timestamptz,
  invoice_id uuid,
  invoice_number text,
  member_id uuid,
  member_name text,
  branch_id uuid,
  branch_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_term text := COALESCE(NULLIF(trim(search_term), ''), '');
BEGIN
  IF v_uid IS NULL OR length(v_term) < 1 THEN
    RETURN;
  END IF;

  IF NOT public.has_any_role(v_uid, ARRAY['owner','admin','manager','staff']::app_role[]) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT pay.id,
         pay.amount,
         pay.payment_method::text,
         pay.status::text,
         pay.payment_date,
         pay.invoice_id,
         inv.invoice_number,
         pay.member_id,
         p.full_name AS member_name,
         pay.branch_id,
         b.name AS branch_name
  FROM public.payments pay
  LEFT JOIN public.invoices inv ON inv.id = pay.invoice_id
  LEFT JOIN public.members m ON m.id = pay.member_id
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.branches b ON b.id = pay.branch_id
  WHERE pay.branch_id IN (SELECT branch_id FROM public.user_visible_branches(v_uid))
    AND (p_branch_id IS NULL OR pay.branch_id = p_branch_id)
    AND (
      COALESCE(pay.transaction_id,'') ILIKE '%' || v_term || '%'
      OR COALESCE(inv.invoice_number,'') ILIKE '%' || v_term || '%'
      OR p.full_name ILIKE '%' || v_term || '%'
      OR COALESCE(m.member_code,'') ILIKE '%' || v_term || '%'
    )
  ORDER BY pay.payment_date DESC
  LIMIT GREATEST(1, LEAST(p_limit, 25));
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_command_payments(text, uuid, int) TO authenticated;

-- =========================================================
-- search_command_bookings (classes + facility benefit + PT)
-- =========================================================
CREATE OR REPLACE FUNCTION public.search_command_bookings(
  search_term text,
  p_branch_id uuid DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  kind text,
  title text,
  when_at timestamptz,
  status text,
  member_id uuid,
  member_name text,
  related_id uuid,
  branch_id uuid,
  branch_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_term text := COALESCE(NULLIF(trim(search_term), ''), '');
  v_is_trainer_only boolean := public.has_role(v_uid, 'trainer'::app_role)
                                 AND NOT public.has_any_role(v_uid, ARRAY['owner','admin','manager','staff']::app_role[]);
BEGIN
  IF v_uid IS NULL OR length(v_term) < 1 THEN
    RETURN;
  END IF;

  IF NOT public.has_any_role(v_uid, ARRAY['owner','admin','manager','staff','trainer']::app_role[]) THEN
    RETURN;
  END IF;

  RETURN QUERY
  -- Class bookings
  SELECT cb.id,
         'class'::text AS kind,
         (c.name || ' — ' || COALESCE(p.full_name, m.member_code, ''))::text AS title,
         c.scheduled_at AS when_at,
         cb.status::text,
         cb.member_id,
         p.full_name AS member_name,
         c.id AS related_id,
         c.branch_id,
         b.name AS branch_name
  FROM public.class_bookings cb
  JOIN public.classes c ON c.id = cb.class_id
  LEFT JOIN public.members m ON m.id = cb.member_id
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.branches b ON b.id = c.branch_id
  WHERE c.branch_id IN (SELECT branch_id FROM public.user_visible_branches(v_uid))
    AND (p_branch_id IS NULL OR c.branch_id = p_branch_id)
    AND (
      c.name ILIKE '%' || v_term || '%'
      OR COALESCE(p.full_name,'') ILIKE '%' || v_term || '%'
    )
    AND (
      NOT v_is_trainer_only
      OR EXISTS (SELECT 1 FROM public.trainers t WHERE t.id = c.trainer_id AND t.user_id = v_uid)
    )

  UNION ALL

  -- PT sessions
  SELECT pts.id,
         'pt'::text AS kind,
         ('PT — ' || COALESCE(p.full_name, m.member_code, ''))::text AS title,
         pts.scheduled_at AS when_at,
         pts.status::text,
         m.id,
         p.full_name AS member_name,
         pts.id AS related_id,
         pts.branch_id,
         b.name AS branch_name
  FROM public.pt_sessions pts
  JOIN public.member_pt_packages mpp ON mpp.id = pts.member_pt_package_id
  LEFT JOIN public.members m ON m.id = mpp.member_id
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.branches b ON b.id = pts.branch_id
  WHERE pts.branch_id IN (SELECT branch_id FROM public.user_visible_branches(v_uid))
    AND (p_branch_id IS NULL OR pts.branch_id = p_branch_id)
    AND (
      COALESCE(p.full_name,'') ILIKE '%' || v_term || '%'
      OR COALESCE(m.member_code,'') ILIKE '%' || v_term || '%'
    )
    AND (
      NOT v_is_trainer_only
      OR EXISTS (SELECT 1 FROM public.trainers t WHERE t.id = pts.trainer_id AND t.user_id = v_uid)
    )

  UNION ALL

  -- Facility (benefit) bookings
  SELECT bb.id,
         'facility'::text AS kind,
         ('Facility — ' || COALESCE(p.full_name, m.member_code, ''))::text AS title,
         bb.booked_at AS when_at,
         bb.status::text,
         bb.member_id,
         p.full_name AS member_name,
         bb.slot_id AS related_id,
         m.branch_id,
         b.name AS branch_name
  FROM public.benefit_bookings bb
  LEFT JOIN public.members m ON m.id = bb.member_id
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.branches b ON b.id = m.branch_id
  WHERE m.branch_id IN (SELECT branch_id FROM public.user_visible_branches(v_uid))
    AND (p_branch_id IS NULL OR m.branch_id = p_branch_id)
    AND (
      COALESCE(p.full_name,'') ILIKE '%' || v_term || '%'
      OR COALESCE(m.member_code,'') ILIKE '%' || v_term || '%'
    )
    AND NOT v_is_trainer_only

  ORDER BY when_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 25));
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_command_bookings(text, uuid, int) TO authenticated;

-- =========================================================
-- search_command_tasks
-- =========================================================
CREATE OR REPLACE FUNCTION public.search_command_tasks(
  search_term text,
  p_branch_id uuid DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  title text,
  status text,
  priority text,
  due_date date,
  assignee_name text,
  branch_id uuid,
  branch_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_term text := COALESCE(NULLIF(trim(search_term), ''), '');
BEGIN
  IF v_uid IS NULL OR length(v_term) < 1 THEN
    RETURN;
  END IF;

  IF NOT public.has_any_role(v_uid, ARRAY['owner','admin','manager','staff','trainer']::app_role[]) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT t.id, t.title, t.status::text, t.priority::text, t.due_date,
         p.full_name AS assignee_name,
         t.branch_id, b.name AS branch_name
  FROM public.tasks t
  LEFT JOIN public.profiles p ON p.id = t.assigned_to
  LEFT JOIN public.branches b ON b.id = t.branch_id
  WHERE t.branch_id IN (SELECT branch_id FROM public.user_visible_branches(v_uid))
    AND (p_branch_id IS NULL OR t.branch_id = p_branch_id)
    AND t.title ILIKE '%' || v_term || '%'
    -- Trainers only see tasks assigned to them
    AND (
      NOT public.has_role(v_uid, 'trainer'::app_role)
      OR public.has_any_role(v_uid, ARRAY['owner','admin','manager','staff']::app_role[])
      OR t.assigned_to = v_uid
    )
  ORDER BY t.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 25));
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_command_tasks(text, uuid, int) TO authenticated;
