-- =========================================================
-- 1) Counter tables (atomic per-branch-per-year sequences)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.member_code_counters (
  branch_id UUID NOT NULL,
  year_yy   TEXT NOT NULL,
  last_seq  INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (branch_id, year_yy)
);
ALTER TABLE public.member_code_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "counters readable by staff"
  ON public.member_code_counters FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('owner','admin','manager','staff'))
  );

CREATE TABLE IF NOT EXISTS public.invoice_number_counters (
  branch_id UUID NOT NULL,
  year_yy   TEXT NOT NULL,
  last_seq  INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (branch_id, year_yy)
);
ALTER TABLE public.invoice_number_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv counters readable by staff"
  ON public.invoice_number_counters FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('owner','admin','manager','staff'))
  );

-- =========================================================
-- 2) Rename existing branch MAIN -> INC
-- =========================================================
UPDATE public.branches
SET code = 'INC'
WHERE id = '11111111-1111-1111-1111-111111111111'
  AND code = 'MAIN';

-- =========================================================
-- 3) Rewrite existing member codes to new format
--    (only 1 row exists, but written generically.)
-- =========================================================
WITH renumbered AS (
  SELECT
    m.id,
    b.code AS branch_code,
    TO_CHAR(COALESCE(m.created_at, now()), 'YY') AS yy,
    ROW_NUMBER() OVER (
      PARTITION BY m.branch_id, TO_CHAR(COALESCE(m.created_at, now()), 'YY')
      ORDER BY m.created_at, m.id
    ) AS seq
  FROM public.members m
  JOIN public.branches b ON b.id = m.branch_id
)
UPDATE public.members m
SET member_code = r.branch_code || '-' || r.yy || '-' || LPAD(r.seq::text, 4, '0')
FROM renumbered r
WHERE m.id = r.id;

-- Seed member counters from the new state
INSERT INTO public.member_code_counters (branch_id, year_yy, last_seq)
SELECT
  m.branch_id,
  split_part(m.member_code, '-', 2) AS year_yy,
  MAX(split_part(m.member_code, '-', 3)::int) AS last_seq
FROM public.members m
WHERE m.member_code ~ '^[A-Z0-9]+-\d{2}-\d{4}$'
GROUP BY m.branch_id, split_part(m.member_code, '-', 2)
ON CONFLICT (branch_id, year_yy) DO UPDATE
  SET last_seq = GREATEST(public.member_code_counters.last_seq, EXCLUDED.last_seq);

-- =========================================================
-- 4) Rewrite existing invoice numbers to new format
-- =========================================================
WITH renum_inv AS (
  SELECT
    i.id,
    b.code AS branch_code,
    TO_CHAR(COALESCE(i.created_at, now()), 'YY') AS yy,
    ROW_NUMBER() OVER (
      PARTITION BY i.branch_id, TO_CHAR(COALESCE(i.created_at, now()), 'YY')
      ORDER BY i.created_at, i.id
    ) AS seq
  FROM public.invoices i
  JOIN public.branches b ON b.id = i.branch_id
)
UPDATE public.invoices i
SET invoice_number = 'INV-' || r.branch_code || '-' || r.yy || '-' || LPAD(r.seq::text, 4, '0')
FROM renum_inv r
WHERE i.id = r.id;

-- Seed invoice counters
INSERT INTO public.invoice_number_counters (branch_id, year_yy, last_seq)
SELECT
  i.branch_id,
  split_part(i.invoice_number, '-', 3) AS year_yy,
  MAX(split_part(i.invoice_number, '-', 4)::int) AS last_seq
FROM public.invoices i
WHERE i.invoice_number ~ '^INV-[A-Z0-9]+-\d{2}-\d{4}$'
GROUP BY i.branch_id, split_part(i.invoice_number, '-', 3)
ON CONFLICT (branch_id, year_yy) DO UPDATE
  SET last_seq = GREATEST(public.invoice_number_counters.last_seq, EXCLUDED.last_seq);

-- =========================================================
-- 5) Replace generate_member_code() with atomic version
-- =========================================================
CREATE OR REPLACE FUNCTION public.generate_member_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_branch_code TEXT;
  v_yy          TEXT;
  v_seq         INTEGER;
BEGIN
  SELECT code INTO v_branch_code FROM public.branches WHERE id = NEW.branch_id;
  IF v_branch_code IS NULL THEN
    v_branch_code := 'X';
  END IF;
  v_yy := TO_CHAR(CURRENT_DATE, 'YY');

  -- Atomic upsert + increment with row lock.
  INSERT INTO public.member_code_counters (branch_id, year_yy, last_seq)
  VALUES (NEW.branch_id, v_yy, 1)
  ON CONFLICT (branch_id, year_yy) DO UPDATE
    SET last_seq = public.member_code_counters.last_seq + 1,
        updated_at = now()
  RETURNING last_seq INTO v_seq;

  NEW.member_code := v_branch_code || '-' || v_yy || '-' || LPAD(v_seq::text, 4, '0');
  RETURN NEW;
END;
$function$;

-- =========================================================
-- 6) Replace generate_invoice_number() with atomic version
-- =========================================================
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_branch_code TEXT;
  v_yy          TEXT;
  v_seq         INTEGER;
BEGIN
  SELECT code INTO v_branch_code FROM public.branches WHERE id = NEW.branch_id;
  IF v_branch_code IS NULL THEN
    v_branch_code := 'X';
  END IF;
  v_yy := TO_CHAR(CURRENT_DATE, 'YY');

  INSERT INTO public.invoice_number_counters (branch_id, year_yy, last_seq)
  VALUES (NEW.branch_id, v_yy, 1)
  ON CONFLICT (branch_id, year_yy) DO UPDATE
    SET last_seq = public.invoice_number_counters.last_seq + 1,
        updated_at = now()
  RETURNING last_seq INTO v_seq;

  NEW.invoice_number := 'INV-' || v_branch_code || '-' || v_yy || '-' || LPAD(v_seq::text, 4, '0');
  RETURN NEW;
END;
$function$;