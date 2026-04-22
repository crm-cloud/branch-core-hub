ALTER TABLE public.member_measurements
ADD COLUMN IF NOT EXISTS gender_presentation text,
ADD COLUMN IF NOT EXISTS shoulder_cm numeric,
ADD COLUMN IF NOT EXISTS neck_cm numeric,
ADD COLUMN IF NOT EXISTS forearm_left_cm numeric,
ADD COLUMN IF NOT EXISTS forearm_right_cm numeric,
ADD COLUMN IF NOT EXISTS wrist_left_cm numeric,
ADD COLUMN IF NOT EXISTS wrist_right_cm numeric,
ADD COLUMN IF NOT EXISTS ankle_left_cm numeric,
ADD COLUMN IF NOT EXISTS ankle_right_cm numeric,
ADD COLUMN IF NOT EXISTS inseam_cm numeric,
ADD COLUMN IF NOT EXISTS torso_length_cm numeric,
ADD COLUMN IF NOT EXISTS abdomen_cm numeric,
ADD COLUMN IF NOT EXISTS front_progress_photo_path text,
ADD COLUMN IF NOT EXISTS side_progress_photo_path text,
ADD COLUMN IF NOT EXISTS posture_type text,
ADD COLUMN IF NOT EXISTS body_shape_profile text,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.extract_member_id_from_storage_path(_path text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  first_segment text;
BEGIN
  first_segment := split_part(coalesce(_path, ''), '/', 1);
  IF first_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN first_segment::uuid;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_member_measurements(_user_id uuid, _member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH member_row AS (
    SELECT id, user_id, branch_id, assigned_trainer_id
    FROM public.members
    WHERE id = _member_id
  )
  SELECT EXISTS (
    SELECT 1
    FROM member_row m
    WHERE m.user_id = _user_id
      OR public.has_any_role(_user_id, ARRAY['owner','admin']::app_role[])
      OR EXISTS (
        SELECT 1
        FROM public.branch_managers bm
        WHERE bm.user_id = _user_id
          AND bm.branch_id = m.branch_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.staff_branches sb
        WHERE sb.user_id = _user_id
          AND sb.branch_id = m.branch_id
          AND public.has_any_role(_user_id, ARRAY['manager','staff']::app_role[])
      )
      OR EXISTS (
        SELECT 1
        FROM public.trainers t
        WHERE t.user_id = _user_id
          AND t.branch_id = m.branch_id
          AND (
            t.id = m.assigned_trainer_id
            OR EXISTS (
              SELECT 1
              FROM public.member_pt_packages mpp
              WHERE mpp.member_id = m.id
                AND mpp.trainer_id = t.id
                AND mpp.status = 'active'
            )
          )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_member_measurements(_user_id uuid, _member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_access_member_measurements(_user_id, _member_id);
$$;

CREATE OR REPLACE FUNCTION public.can_access_member_measurement_photo(_user_id uuid, _path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.extract_member_id_from_storage_path(_path) IS NULL THEN false
    ELSE public.can_access_member_measurements(_user_id, public.extract_member_id_from_storage_path(_path))
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_write_member_measurement_photo(_user_id uuid, _path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.extract_member_id_from_storage_path(_path) IS NULL THEN false
    ELSE public.can_write_member_measurements(_user_id, public.extract_member_id_from_storage_path(_path))
  END;
$$;

CREATE OR REPLACE FUNCTION public.assert_measurement_range(_value numeric, _field text, _min numeric, _max numeric)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF _value IS NULL THEN
    RETURN NULL;
  END IF;

  IF _value < _min OR _value > _max THEN
    RAISE EXCEPTION '% must be between % and %', _field, _min, _max;
  END IF;

  RETURN round(_value::numeric, 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_member_measurement_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  photo_item jsonb;
BEGIN
  NEW.notes := NULLIF(btrim(COALESCE(NEW.notes, '')), '');
  NEW.gender_presentation := lower(NULLIF(btrim(COALESCE(NEW.gender_presentation, '')), ''));
  NEW.front_progress_photo_path := NULLIF(btrim(COALESCE(NEW.front_progress_photo_path, '')), '');
  NEW.side_progress_photo_path := NULLIF(btrim(COALESCE(NEW.side_progress_photo_path, '')), '');
  NEW.posture_type := NULLIF(btrim(COALESCE(NEW.posture_type, '')), '');
  NEW.body_shape_profile := NULLIF(btrim(COALESCE(NEW.body_shape_profile, '')), '');
  NEW.photos := COALESCE(NEW.photos, '[]'::jsonb);

  IF NEW.gender_presentation IS NOT NULL AND NEW.gender_presentation NOT IN ('male', 'female', 'other') THEN
    RAISE EXCEPTION 'gender_presentation must be male, female, or other';
  END IF;

  IF jsonb_typeof(NEW.photos) <> 'array' THEN
    RAISE EXCEPTION 'photos must be an array of storage paths';
  END IF;

  FOR photo_item IN SELECT * FROM jsonb_array_elements(NEW.photos)
  LOOP
    IF jsonb_typeof(photo_item) <> 'string' THEN
      RAISE EXCEPTION 'photos must only contain storage path strings';
    END IF;

    IF public.extract_member_id_from_storage_path(trim(both '"' from photo_item::text)) IS DISTINCT FROM NEW.member_id THEN
      RAISE EXCEPTION 'photo paths must belong to the same member';
    END IF;
  END LOOP;

  IF NEW.front_progress_photo_path IS NOT NULL
     AND public.extract_member_id_from_storage_path(NEW.front_progress_photo_path) IS DISTINCT FROM NEW.member_id THEN
    RAISE EXCEPTION 'front progress photo must belong to the same member';
  END IF;

  IF NEW.side_progress_photo_path IS NOT NULL
     AND public.extract_member_id_from_storage_path(NEW.side_progress_photo_path) IS DISTINCT FROM NEW.member_id THEN
    RAISE EXCEPTION 'side progress photo must belong to the same member';
  END IF;

  NEW.weight_kg := public.assert_measurement_range(NEW.weight_kg, 'weight_kg', 25, 350);
  NEW.height_cm := public.assert_measurement_range(NEW.height_cm, 'height_cm', 100, 250);
  NEW.body_fat_percentage := public.assert_measurement_range(NEW.body_fat_percentage, 'body_fat_percentage', 2, 70);
  NEW.chest_cm := public.assert_measurement_range(NEW.chest_cm, 'chest_cm', 40, 220);
  NEW.waist_cm := public.assert_measurement_range(NEW.waist_cm, 'waist_cm', 35, 220);
  NEW.hips_cm := public.assert_measurement_range(NEW.hips_cm, 'hips_cm', 45, 240);
  NEW.biceps_left_cm := public.assert_measurement_range(NEW.biceps_left_cm, 'biceps_left_cm', 12, 80);
  NEW.biceps_right_cm := public.assert_measurement_range(NEW.biceps_right_cm, 'biceps_right_cm', 12, 80);
  NEW.thighs_left_cm := public.assert_measurement_range(NEW.thighs_left_cm, 'thighs_left_cm', 20, 120);
  NEW.thighs_right_cm := public.assert_measurement_range(NEW.thighs_right_cm, 'thighs_right_cm', 20, 120);
  NEW.calves_cm := public.assert_measurement_range(NEW.calves_cm, 'calves_cm', 18, 70);
  NEW.shoulder_cm := public.assert_measurement_range(NEW.shoulder_cm, 'shoulder_cm', 25, 90);
  NEW.neck_cm := public.assert_measurement_range(NEW.neck_cm, 'neck_cm', 20, 60);
  NEW.forearm_left_cm := public.assert_measurement_range(NEW.forearm_left_cm, 'forearm_left_cm', 12, 55);
  NEW.forearm_right_cm := public.assert_measurement_range(NEW.forearm_right_cm, 'forearm_right_cm', 12, 55);
  NEW.wrist_left_cm := public.assert_measurement_range(NEW.wrist_left_cm, 'wrist_left_cm', 8, 30);
  NEW.wrist_right_cm := public.assert_measurement_range(NEW.wrist_right_cm, 'wrist_right_cm', 8, 30);
  NEW.ankle_left_cm := public.assert_measurement_range(NEW.ankle_left_cm, 'ankle_left_cm', 10, 40);
  NEW.ankle_right_cm := public.assert_measurement_range(NEW.ankle_right_cm, 'ankle_right_cm', 10, 40);
  NEW.inseam_cm := public.assert_measurement_range(NEW.inseam_cm, 'inseam_cm', 40, 130);
  NEW.torso_length_cm := public.assert_measurement_range(NEW.torso_length_cm, 'torso_length_cm', 30, 90);
  NEW.abdomen_cm := public.assert_measurement_range(NEW.abdomen_cm, 'abdomen_cm', 35, 220);

  IF NEW.recorded_by IS NULL THEN
    NEW.recorded_by := auth.uid();
  END IF;

  IF COALESCE(jsonb_array_length(NEW.photos), 0) = 0
     AND NEW.front_progress_photo_path IS NULL
     AND NEW.side_progress_photo_path IS NULL
     AND NEW.weight_kg IS NULL
     AND NEW.height_cm IS NULL
     AND NEW.body_fat_percentage IS NULL
     AND NEW.chest_cm IS NULL
     AND NEW.waist_cm IS NULL
     AND NEW.hips_cm IS NULL
     AND NEW.biceps_left_cm IS NULL
     AND NEW.biceps_right_cm IS NULL
     AND NEW.thighs_left_cm IS NULL
     AND NEW.thighs_right_cm IS NULL
     AND NEW.calves_cm IS NULL
     AND NEW.shoulder_cm IS NULL
     AND NEW.neck_cm IS NULL
     AND NEW.forearm_left_cm IS NULL
     AND NEW.forearm_right_cm IS NULL
     AND NEW.wrist_left_cm IS NULL
     AND NEW.wrist_right_cm IS NULL
     AND NEW.ankle_left_cm IS NULL
     AND NEW.ankle_right_cm IS NULL
     AND NEW.inseam_cm IS NULL
     AND NEW.torso_length_cm IS NULL
     AND NEW.abdomen_cm IS NULL THEN
    RAISE EXCEPTION 'At least one measurement or progress photo is required';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_member_measurement_row_trigger ON public.member_measurements;
CREATE TRIGGER validate_member_measurement_row_trigger
BEFORE INSERT OR UPDATE ON public.member_measurements
FOR EACH ROW
EXECUTE FUNCTION public.validate_member_measurement_row();

DROP TRIGGER IF EXISTS update_member_measurements_updated_at ON public.member_measurements;
CREATE TRIGGER update_member_measurements_updated_at
BEFORE UPDATE ON public.member_measurements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.record_member_measurement(p_member_id uuid, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_measurement_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.can_write_member_measurements(v_user_id, p_member_id) THEN
    RAISE EXCEPTION 'You are not allowed to record measurements for this member';
  END IF;

  INSERT INTO public.member_measurements (
    member_id,
    recorded_by,
    recorded_at,
    weight_kg,
    height_cm,
    body_fat_percentage,
    chest_cm,
    waist_cm,
    hips_cm,
    biceps_left_cm,
    biceps_right_cm,
    thighs_left_cm,
    thighs_right_cm,
    calves_cm,
    gender_presentation,
    shoulder_cm,
    neck_cm,
    forearm_left_cm,
    forearm_right_cm,
    wrist_left_cm,
    wrist_right_cm,
    ankle_left_cm,
    ankle_right_cm,
    inseam_cm,
    torso_length_cm,
    abdomen_cm,
    notes,
    photos,
    front_progress_photo_path,
    side_progress_photo_path,
    posture_type,
    body_shape_profile
  )
  VALUES (
    p_member_id,
    v_user_id,
    COALESCE(NULLIF(p_payload->>'recorded_at', '')::timestamptz, now()),
    NULLIF(trim(p_payload->>'weight_kg'), '')::numeric,
    NULLIF(trim(p_payload->>'height_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'body_fat_percentage'), '')::numeric,
    NULLIF(trim(p_payload->>'chest_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'waist_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'hips_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'biceps_left_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'biceps_right_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'thighs_left_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'thighs_right_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'calves_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'gender_presentation'), ''),
    NULLIF(trim(p_payload->>'shoulder_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'neck_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'forearm_left_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'forearm_right_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'wrist_left_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'wrist_right_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'ankle_left_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'ankle_right_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'inseam_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'torso_length_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'abdomen_cm'), '')::numeric,
    NULLIF(trim(p_payload->>'notes'), ''),
    COALESCE(p_payload->'photos', '[]'::jsonb),
    NULLIF(trim(p_payload->>'front_progress_photo_path'), ''),
    NULLIF(trim(p_payload->>'side_progress_photo_path'), ''),
    NULLIF(trim(p_payload->>'posture_type'), ''),
    NULLIF(trim(p_payload->>'body_shape_profile'), '')
  )
  RETURNING id INTO v_measurement_id;

  RETURN v_measurement_id;
END;
$$;

ALTER TABLE public.member_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view all measurements" ON public.member_measurements;
DROP POLICY IF EXISTS "Members can view their own measurements" ON public.member_measurements;
DROP POLICY IF EXISTS "Staff can insert measurements" ON public.member_measurements;
DROP POLICY IF EXISTS "Members can insert their own measurements" ON public.member_measurements;
DROP POLICY IF EXISTS "Staff can update measurements" ON public.member_measurements;
DROP POLICY IF EXISTS "Staff can delete measurements" ON public.member_measurements;
DROP POLICY IF EXISTS "Authorized users can view member measurements" ON public.member_measurements;
DROP POLICY IF EXISTS "Authorized users can delete member measurements" ON public.member_measurements;

CREATE POLICY "Authorized users can view member measurements"
ON public.member_measurements
FOR SELECT
USING (public.can_access_member_measurements(auth.uid(), member_id));

CREATE POLICY "Authorized users can delete member measurements"
ON public.member_measurements
FOR DELETE
USING (public.can_write_member_measurements(auth.uid(), member_id));

UPDATE storage.buckets
SET public = false
WHERE id = 'member-photos';

DROP POLICY IF EXISTS "Anyone can view member photos" ON storage.objects;
DROP POLICY IF EXISTS "Members can view own photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload member photos" ON storage.objects;
DROP POLICY IF EXISTS "Members can upload their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete member photos" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can view member measurement photos" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can upload member measurement photos" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can update member measurement photos" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can delete member measurement photos" ON storage.objects;

CREATE POLICY "Authorized users can view member measurement photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'member-photos'
  AND public.can_access_member_measurement_photo(auth.uid(), name)
);

CREATE POLICY "Authorized users can upload member measurement photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'member-photos'
  AND public.can_write_member_measurement_photo(auth.uid(), name)
);

CREATE POLICY "Authorized users can update member measurement photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'member-photos'
  AND public.can_write_member_measurement_photo(auth.uid(), name)
)
WITH CHECK (
  bucket_id = 'member-photos'
  AND public.can_write_member_measurement_photo(auth.uid(), name)
);

CREATE POLICY "Authorized users can delete member measurement photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'member-photos'
  AND public.can_write_member_measurement_photo(auth.uid(), name)
);

GRANT EXECUTE ON FUNCTION public.record_member_measurement(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_member_measurements(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_member_measurements(uuid, uuid) TO authenticated;