
-- Phone normalizer (idempotent helper)
CREATE OR REPLACE FUNCTION public.normalize_phone_in(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text;
BEGIN
  IF p IS NULL THEN RETURN NULL; END IF;
  s := regexp_replace(p, '[^0-9+]', '', 'g');
  IF s = '' THEN RETURN NULL; END IF;
  -- already has + → keep
  IF left(s,1) = '+' THEN
    RETURN s;
  END IF;
  -- 10-digit Indian mobile starting 6/7/8/9 → assume +91
  IF length(s) = 10 AND s ~ '^[6-9]' THEN
    RETURN '+91' || s;
  END IF;
  -- 12-digit starting with 91 → +91XXXXXXXXXX
  IF length(s) = 12 AND left(s,2) = '91' THEN
    RETURN '+' || s;
  END IF;
  -- fallback: prefix +
  RETURN '+' || s;
END;
$$;

CREATE TABLE IF NOT EXISTS public.contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  full_name   text NOT NULL,
  phone       text NOT NULL,
  email       text,
  category    text NOT NULL DEFAULT 'general',
  company     text,
  notes       text,
  tags        text[] NOT NULL DEFAULT '{}',
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS contacts_branch_phone_uniq
  ON public.contacts (branch_id, phone);
CREATE INDEX IF NOT EXISTS contacts_phone_idx ON public.contacts (phone);

-- Normalize phone on insert/update
CREATE OR REPLACE FUNCTION public.contacts_normalize_phone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.phone := public.normalize_phone_in(NEW.phone);
  IF NEW.phone IS NULL OR NEW.phone = '' THEN
    RAISE EXCEPTION 'phone is required';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_normalize_phone_trg ON public.contacts;
CREATE TRIGGER contacts_normalize_phone_trg
BEFORE INSERT OR UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.contacts_normalize_phone();

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Read: any staff role in any branch (branch isolation can be tightened later if desired)
CREATE POLICY "contacts_select_staff"
ON public.contacts
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'owner')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'staff')
  OR public.has_role(auth.uid(), 'trainer')
);

-- Insert/Update/Delete: owner/admin/manager/staff
CREATE POLICY "contacts_write_staff"
ON public.contacts
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'owner')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'staff')
);

CREATE POLICY "contacts_update_staff"
ON public.contacts
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'owner')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'staff')
);

CREATE POLICY "contacts_delete_staff"
ON public.contacts
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'owner')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
);
