
-- ============================================================
-- PART A: equipment muscle-group taxonomy (idempotent re-apply)
-- ============================================================
ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS primary_category text,
  ADD COLUMN IF NOT EXISTS muscle_groups   text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS movement_pattern text;

UPDATE public.equipment
   SET primary_category = CASE lower(coalesce(category, ''))
     WHEN 'cardio'        THEN 'cardio'
     WHEN 'strength'      THEN 'strength_machine'
     WHEN 'machines'      THEN 'strength_machine'
     WHEN 'free weights'  THEN 'free_weight'
     WHEN 'functional'    THEN 'functional'
     WHEN 'recovery'      THEN 'recovery'
     ELSE 'accessory'
   END
 WHERE primary_category IS NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_muscle_groups
  ON public.equipment USING GIN (muscle_groups);
CREATE INDEX IF NOT EXISTS idx_equipment_primary_category
  ON public.equipment (primary_category);

-- ============================================================
-- PART B: fitness_plan_templates audience targeting (idempotent)
-- ============================================================
ALTER TABLE public.fitness_plan_templates
  ADD COLUMN IF NOT EXISTS target_age_min        int,
  ADD COLUMN IF NOT EXISTS target_age_max        int,
  ADD COLUMN IF NOT EXISTS target_gender         text NOT NULL DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS target_weight_min_kg  numeric(5,2),
  ADD COLUMN IF NOT EXISTS target_weight_max_kg  numeric(5,2),
  ADD COLUMN IF NOT EXISTS target_bmi_min        numeric(4,1),
  ADD COLUMN IF NOT EXISTS target_bmi_max        numeric(4,1),
  ADD COLUMN IF NOT EXISTS target_goal           text,
  ADD COLUMN IF NOT EXISTS target_experience     text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS duration_weeks        int,
  ADD COLUMN IF NOT EXISTS days_per_week         int;

ALTER TABLE public.fitness_plan_templates
  DROP CONSTRAINT IF EXISTS fitness_plan_templates_target_gender_check;
ALTER TABLE public.fitness_plan_templates
  ADD  CONSTRAINT fitness_plan_templates_target_gender_check
       CHECK (target_gender IN ('any','male','female'));

CREATE INDEX IF NOT EXISTS idx_ftpl_common_goal
  ON public.fitness_plan_templates (type, target_goal)
  WHERE is_common = true AND is_active = true;

-- ============================================================
-- PART C: match_common_plans(member, type)
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_common_plans(
  p_member_id uuid,
  p_type      text
)
RETURNS TABLE (
  template_id     uuid,
  name            text,
  description     text,
  goal            text,
  difficulty      text,
  duration_weeks  int,
  days_per_week   int,
  target_goal     text,
  target_gender   text,
  target_age_min  int,
  target_age_max  int,
  match_score     int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH m AS (
    SELECT
      lower(coalesce(p.gender::text, '')) AS gender,
      CASE WHEN p.date_of_birth IS NULL THEN NULL
           ELSE date_part('year', age(p.date_of_birth))::int END AS age,
      lm.weight_kg,
      lm.height_cm,
      CASE
        WHEN lm.weight_kg IS NULL OR lm.height_cm IS NULL OR lm.height_cm = 0 THEN NULL
        ELSE round( (lm.weight_kg / power(lm.height_cm/100.0, 2))::numeric, 1)
      END AS bmi,
      mb.fitness_goals,
      lower(coalesce(mb.fitness_level,'')) AS fitness_level
    FROM public.members mb
    LEFT JOIN public.profiles p ON p.id = mb.user_id
    LEFT JOIN LATERAL (
      SELECT mm.weight_kg, mm.height_cm
        FROM public.member_measurements mm
       WHERE mm.member_id = mb.id
       ORDER BY mm.created_at DESC
       LIMIT 1
    ) lm ON true
    WHERE mb.id = p_member_id
  )
  SELECT
    t.id,
    t.name,
    t.description,
    t.goal,
    t.difficulty,
    t.duration_weeks,
    t.days_per_week,
    t.target_goal,
    t.target_gender,
    t.target_age_min,
    t.target_age_max,
    (
        CASE WHEN t.target_gender = 'any' OR t.target_gender = m.gender THEN 30 ELSE 0 END
      + CASE
          WHEN m.age IS NULL THEN 5
          WHEN (t.target_age_min IS NULL OR m.age >= t.target_age_min)
           AND (t.target_age_max IS NULL OR m.age <= t.target_age_max) THEN 25
          ELSE 0
        END
      + CASE
          WHEN t.target_weight_min_kg IS NULL AND t.target_weight_max_kg IS NULL
           AND t.target_bmi_min IS NULL AND t.target_bmi_max IS NULL THEN 10
          WHEN m.weight_kg IS NOT NULL
           AND (t.target_weight_min_kg IS NULL OR m.weight_kg >= t.target_weight_min_kg)
           AND (t.target_weight_max_kg IS NULL OR m.weight_kg <= t.target_weight_max_kg) THEN 20
          WHEN m.bmi IS NOT NULL
           AND (t.target_bmi_min IS NULL OR m.bmi >= t.target_bmi_min)
           AND (t.target_bmi_max IS NULL OR m.bmi <= t.target_bmi_max) THEN 20
          ELSE 0
        END
      + CASE
          WHEN t.target_goal IS NULL THEN 5
          WHEN m.fitness_goals IS NULL THEN 5
          WHEN lower(t.target_goal) = ANY (string_to_array(lower(m.fitness_goals), ',')) THEN 15
          WHEN position(lower(t.target_goal) in lower(m.fitness_goals)) > 0 THEN 8
          ELSE 0
        END
      + CASE
          WHEN coalesce(array_length(t.target_experience,1),0) = 0 THEN 5
          WHEN m.fitness_level = ANY (t.target_experience) THEN 10
          ELSE 0
        END
    )::int AS match_score
  FROM public.fitness_plan_templates t
  CROSS JOIN m
  WHERE t.is_common = true
    AND t.is_active = true
    AND t.type = p_type
  ORDER BY match_score DESC, t.created_at DESC
  LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION public.match_common_plans(uuid, text)
  TO authenticated;
