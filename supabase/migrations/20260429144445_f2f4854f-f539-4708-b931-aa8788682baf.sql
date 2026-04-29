DO $$
DECLARE
  v_pair RECORD;
  v_canonical_id UUID;
  v_dup_id UUID;
  v_canonical_name TEXT;
  v_canonical_code TEXT;
BEGIN
  FOR v_pair IN
    SELECT * FROM (VALUES
      ('Ice Bath',      'ice_bath', ARRAY['Ice Bath Male','Ice Bath Female']),
      ('Sauna Therapy', 'sauna',    ARRAY['Sauna Therapy Male','Sauna Therapy Female'])
    ) AS t(keep_name, keep_code, dup_names)
  LOOP
    FOR v_canonical_id, v_canonical_name, v_canonical_code IN
      SELECT DISTINCT ON (branch_id) id, v_pair.keep_name, v_pair.keep_code
      FROM benefit_types
      WHERE name = ANY(v_pair.dup_names)
      ORDER BY branch_id, created_at ASC
    LOOP
      UPDATE benefit_types
        SET name = v_canonical_name, code = v_canonical_code, updated_at = now()
        WHERE id = v_canonical_id;

      FOR v_dup_id IN
        SELECT bt.id FROM benefit_types bt
        JOIN benefit_types canon ON canon.id = v_canonical_id
        WHERE bt.branch_id = canon.branch_id
          AND bt.name = ANY(v_pair.dup_names)
          AND bt.id <> v_canonical_id
      LOOP
        -- plan_benefits: merge by summing limit_count when plan already has canonical row
        UPDATE plan_benefits canon
          SET limit_count = COALESCE(canon.limit_count,0) + COALESCE(dup.limit_count,0)
          FROM plan_benefits dup
          WHERE dup.benefit_type_id = v_dup_id
            AND canon.plan_id = dup.plan_id
            AND canon.benefit_type_id = v_canonical_id
            AND canon.benefit_type = dup.benefit_type;
        DELETE FROM plan_benefits dup
          WHERE dup.benefit_type_id = v_dup_id
            AND EXISTS (
              SELECT 1 FROM plan_benefits canon
              WHERE canon.plan_id = dup.plan_id
                AND canon.benefit_type_id = v_canonical_id
                AND canon.benefit_type = dup.benefit_type
            );
        UPDATE plan_benefits SET benefit_type_id = v_canonical_id WHERE benefit_type_id = v_dup_id;

        -- benefit_settings: keep canonical, drop dup if both exist for same branch
        DELETE FROM benefit_settings dup
          WHERE dup.benefit_type_id = v_dup_id
            AND EXISTS (
              SELECT 1 FROM benefit_settings canon
              WHERE canon.branch_id = dup.branch_id AND canon.benefit_type_id = v_canonical_id
            );
        UPDATE benefit_settings SET benefit_type_id = v_canonical_id WHERE benefit_type_id = v_dup_id;

        -- Other tables: straight repoint (no unique constraint conflicts)
        UPDATE facilities             SET benefit_type_id = v_canonical_id WHERE benefit_type_id = v_dup_id;
        UPDATE benefit_packages       SET benefit_type_id = v_canonical_id WHERE benefit_type_id = v_dup_id;
        UPDATE benefit_slots          SET benefit_type_id = v_canonical_id WHERE benefit_type_id = v_dup_id;
        UPDATE benefit_usage          SET benefit_type_id = v_canonical_id WHERE benefit_type_id = v_dup_id;
        UPDATE member_benefit_credits SET benefit_type_id = v_canonical_id WHERE benefit_type_id = v_dup_id;
        UPDATE member_comps           SET benefit_type_id = v_canonical_id WHERE benefit_type_id = v_dup_id;

        UPDATE benefit_types
          SET is_active = false,
              code = code || '_merged_' || to_char(now(),'YYYYMMDDHH24MISS'),
              updated_at = now()
          WHERE id = v_dup_id;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_benefit_types_branch_name_ci
  ON public.benefit_types (branch_id, lower(name))
  WHERE is_active = true;
