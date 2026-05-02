-- 1. Source tracking columns
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id uuid;

CREATE INDEX IF NOT EXISTS contacts_source_idx ON public.contacts(source_type, source_id);

-- Allow upserts that target source rows (per branch+source_type+source_id)
CREATE UNIQUE INDEX IF NOT EXISTS contacts_branch_source_uniq
  ON public.contacts(branch_id, source_type, source_id)
  WHERE source_id IS NOT NULL;

-- 2. Lead -> contact sync
CREATE OR REPLACE FUNCTION public.sync_lead_to_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
BEGIN
  v_phone := public.normalize_phone_in(NEW.phone);
  IF v_phone IS NULL OR NEW.full_name IS NULL OR NEW.branch_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.contacts (
    branch_id, full_name, phone, email, category, source_type, source_id, notes
  ) VALUES (
    NEW.branch_id, NEW.full_name, v_phone, NULLIF(NEW.email,''), 'prospect', 'lead', NEW.id,
    CASE WHEN NEW.source IS NOT NULL THEN 'Lead source: ' || NEW.source ELSE NULL END
  )
  ON CONFLICT (branch_id, phone) DO UPDATE
    SET full_name   = EXCLUDED.full_name,
        email       = COALESCE(EXCLUDED.email, public.contacts.email),
        source_type = CASE WHEN public.contacts.source_type = 'manual' THEN 'lead' ELSE public.contacts.source_type END,
        source_id   = COALESCE(public.contacts.source_id, EXCLUDED.source_id),
        category    = CASE WHEN public.contacts.category = 'general' THEN 'prospect' ELSE public.contacts.category END,
        updated_at  = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_sync_contact_trg ON public.leads;
CREATE TRIGGER leads_sync_contact_trg
AFTER INSERT OR UPDATE OF full_name, phone, email, branch_id ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.sync_lead_to_contact();

-- 3. Member (profile) -> contact sync
CREATE OR REPLACE FUNCTION public.sync_member_to_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_name  text;
  v_email text;
  v_branch uuid;
  v_member_id uuid;
BEGIN
  -- Resolve member row (may come via members trigger or profiles trigger)
  IF TG_TABLE_NAME = 'members' THEN
    v_member_id := NEW.id;
    v_branch    := NEW.branch_id;
    SELECT p.full_name, p.phone, p.email
      INTO v_name, v_phone, v_email
    FROM public.profiles p WHERE p.id = NEW.user_id;
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    SELECT m.id, m.branch_id INTO v_member_id, v_branch
    FROM public.members m WHERE m.user_id = NEW.id LIMIT 1;
    v_name := NEW.full_name;
    v_phone := NEW.phone;
    v_email := NEW.email;
  END IF;

  IF v_member_id IS NULL OR v_branch IS NULL THEN RETURN NEW; END IF;
  v_phone := public.normalize_phone_in(v_phone);
  IF v_phone IS NULL OR v_name IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.contacts (
    branch_id, full_name, phone, email, category, source_type, source_id
  ) VALUES (
    v_branch, v_name, v_phone, NULLIF(v_email,''), 'general', 'member', v_member_id
  )
  ON CONFLICT (branch_id, phone) DO UPDATE
    SET full_name   = EXCLUDED.full_name,
        email       = COALESCE(EXCLUDED.email, public.contacts.email),
        source_type = 'member',
        source_id   = EXCLUDED.source_id,
        updated_at  = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS members_sync_contact_trg ON public.members;
CREATE TRIGGER members_sync_contact_trg
AFTER INSERT OR UPDATE OF user_id, branch_id ON public.members
FOR EACH ROW EXECUTE FUNCTION public.sync_member_to_contact();

DROP TRIGGER IF EXISTS profiles_sync_contact_trg ON public.profiles;
CREATE TRIGGER profiles_sync_contact_trg
AFTER UPDATE OF full_name, phone, email ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_member_to_contact();

-- 4. Backfill from existing leads
INSERT INTO public.contacts (branch_id, full_name, phone, email, category, source_type, source_id)
SELECT l.branch_id, l.full_name, public.normalize_phone_in(l.phone),
       NULLIF(l.email,''), 'prospect', 'lead', l.id
FROM public.leads l
WHERE l.phone IS NOT NULL AND l.full_name IS NOT NULL AND l.branch_id IS NOT NULL
  AND public.normalize_phone_in(l.phone) IS NOT NULL
ON CONFLICT (branch_id, phone) DO NOTHING;

-- 5. Backfill from existing members + profiles
INSERT INTO public.contacts (branch_id, full_name, phone, email, category, source_type, source_id)
SELECT m.branch_id, p.full_name, public.normalize_phone_in(p.phone),
       NULLIF(p.email,''), 'general', 'member', m.id
FROM public.members m
JOIN public.profiles p ON p.id = m.user_id
WHERE p.phone IS NOT NULL AND p.full_name IS NOT NULL
  AND public.normalize_phone_in(p.phone) IS NOT NULL
ON CONFLICT (branch_id, phone) DO UPDATE
  SET source_type = 'member',
      source_id   = EXCLUDED.source_id,
      full_name   = EXCLUDED.full_name,
      email       = COALESCE(EXCLUDED.email, public.contacts.email),
      updated_at  = now();

-- 6. AI / Marketing helper to drop a lead atomically (also flows into contacts via trigger)
CREATE OR REPLACE FUNCTION public.create_ai_lead(
  p_branch_id uuid,
  p_full_name text,
  p_phone text,
  p_email text DEFAULT NULL,
  p_source text DEFAULT 'ai_agent',
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_tags text[] DEFAULT '{}'::text[],
  p_temperature text DEFAULT 'warm'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_lead_id uuid;
  v_existing uuid;
BEGIN
  IF p_branch_id IS NULL OR p_full_name IS NULL OR p_phone IS NULL THEN
    RAISE EXCEPTION 'branch_id, full_name and phone are required';
  END IF;

  v_phone := public.normalize_phone_in(p_phone);
  IF v_phone IS NULL THEN RAISE EXCEPTION 'invalid phone'; END IF;

  -- Dedupe: if a lead already exists for this phone in this branch, return it
  SELECT id INTO v_existing
  FROM public.leads
  WHERE branch_id = p_branch_id
    AND public.normalize_phone_in(phone) = v_phone
  ORDER BY created_at DESC LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'lead_id', v_existing, 'duplicate', true);
  END IF;

  INSERT INTO public.leads (
    branch_id, full_name, phone, email, source,
    utm_source, utm_medium, utm_campaign, notes, tags, temperature, status
  ) VALUES (
    p_branch_id, p_full_name, v_phone, NULLIF(p_email,''), p_source,
    p_utm_source, p_utm_medium, p_utm_campaign, p_notes, COALESCE(p_tags,'{}'::text[]),
    COALESCE(p_temperature,'warm'), 'new'
  )
  RETURNING id INTO v_lead_id;

  RETURN jsonb_build_object('success', true, 'lead_id', v_lead_id, 'duplicate', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_ai_lead(uuid, text, text, text, text, text, text, text, text, text[], text) TO authenticated, service_role;