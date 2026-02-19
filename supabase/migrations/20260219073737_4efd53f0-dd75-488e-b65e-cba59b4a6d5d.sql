
-- =============================================
-- 1. DROP OLD DUPLICATE AUDIT TRIGGERS
-- =============================================
DROP TRIGGER IF EXISTS audit_employees ON public.employees;
DROP TRIGGER IF EXISTS audit_members ON public.members;
DROP TRIGGER IF EXISTS audit_trainers ON public.trainers;
DROP TRIGGER IF EXISTS audit_memberships ON public.memberships;
DROP TRIGGER IF EXISTS audit_invoices ON public.invoices;
DROP TRIGGER IF EXISTS audit_payments ON public.payments;
DROP TRIGGER IF EXISTS audit_classes ON public.classes;
DROP TRIGGER IF EXISTS audit_leads ON public.leads;
DROP TRIGGER IF EXISTS audit_lockers ON public.lockers;

-- Drop the old function
DROP FUNCTION IF EXISTS public.log_audit_change() CASCADE;

-- =============================================
-- 2. ADD MISSING AUDIT TRIGGERS (using the correct function)
-- =============================================
-- Ensure triggers exist for all important tables using audit_log_trigger_function
CREATE OR REPLACE TRIGGER audit_classes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_function();

CREATE OR REPLACE TRIGGER audit_leads_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_function();

CREATE OR REPLACE TRIGGER audit_lockers_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.lockers
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_function();

-- =============================================
-- 3. BACKFILL NULL actor_name FROM profiles
-- =============================================
UPDATE public.audit_logs al
SET actor_name = COALESCE(p.full_name, 'System'),
    action_description = COALESCE(p.full_name, 'System') || ' ' ||
      CASE al.action
        WHEN 'INSERT' THEN 'created'
        WHEN 'UPDATE' THEN 'updated'
        WHEN 'DELETE' THEN 'deleted'
        ELSE al.action
      END || ' ' || al.table_name
FROM public.profiles p
WHERE al.actor_name IS NULL
  AND al.user_id IS NOT NULL
  AND al.user_id = p.id;

-- For rows with no user_id at all, set to 'System'
UPDATE public.audit_logs
SET actor_name = 'System'
WHERE actor_name IS NULL AND user_id IS NULL;

-- =============================================
-- 4. FIX ensure_facility_slots TYPE CASTS
-- =============================================
CREATE OR REPLACE FUNCTION public.ensure_facility_slots(p_branch_id uuid, p_start_date date, p_end_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_facility RECORD;
  v_settings RECORD;
  v_current_date DATE;
  v_day_abbr TEXT;
  v_start_time TIME;
  v_end_time TIME;
  v_duration INT;
  v_buffer INT;
  v_capacity INT;
  v_slot_start TIME;
  v_slot_end TIME;
  v_safe_bt TEXT;
BEGIN
  FOR v_facility IN
    SELECT f.id, f.benefit_type_id, f.capacity AS fac_capacity,
           COALESCE(f.available_days, ARRAY['mon','tue','wed','thu','fri','sat','sun']) AS available_days
    FROM facilities f
    WHERE f.branch_id = p_branch_id
      AND f.is_active = true
      AND COALESCE(f.under_maintenance, false) = false
  LOOP
    SELECT bs.operating_hours_start, bs.operating_hours_end,
           bs.slot_duration_minutes, bs.buffer_between_sessions_minutes,
           bs.capacity_per_slot, bs.is_slot_booking_enabled,
           bs.benefit_type
    INTO v_settings
    FROM benefit_settings bs
    WHERE bs.branch_id = p_branch_id
      AND bs.benefit_type_id = v_facility.benefit_type_id
    LIMIT 1;

    IF v_settings IS NOT NULL AND v_settings.is_slot_booking_enabled = false THEN
      CONTINUE;
    END IF;

    v_start_time := COALESCE(v_settings.operating_hours_start, '06:00:00')::TIME;
    v_end_time := COALESCE(v_settings.operating_hours_end, '22:00:00')::TIME;
    v_duration := COALESCE(v_settings.slot_duration_minutes, 30);
    v_buffer := COALESCE(v_settings.buffer_between_sessions_minutes, 0);
    v_capacity := COALESCE(v_facility.fac_capacity, v_settings.capacity_per_slot, 1);
    v_safe_bt := COALESCE(v_settings.benefit_type::TEXT, 'other');

    v_current_date := p_start_date;
    WHILE v_current_date <= p_end_date LOOP
      v_day_abbr := LOWER(LEFT(TO_CHAR(v_current_date, 'Dy'), 3));

      IF v_day_abbr = ANY(v_facility.available_days) THEN
        -- FIXED: removed ::TEXT cast on slot_date comparison
        IF NOT EXISTS (
          SELECT 1 FROM benefit_slots
          WHERE facility_id = v_facility.id
            AND slot_date = v_current_date
            AND is_active = true
        ) THEN
          v_slot_start := v_start_time;
          WHILE v_slot_start + (v_duration || ' minutes')::INTERVAL <= v_end_time LOOP
            v_slot_end := v_slot_start + (v_duration || ' minutes')::INTERVAL;

            -- FIXED: removed ::TEXT casts on slot_date, start_time, end_time
            INSERT INTO benefit_slots (
              branch_id, benefit_type, benefit_type_id, facility_id,
              slot_date, start_time, end_time, capacity, is_active
            ) VALUES (
              p_branch_id,
              v_safe_bt::benefit_type,
              v_facility.benefit_type_id,
              v_facility.id,
              v_current_date,
              v_slot_start,
              v_slot_end,
              v_capacity,
              true
            );

            v_slot_start := v_slot_end + (v_buffer || ' minutes')::INTERVAL;
          END LOOP;
        END IF;
      END IF;

      v_current_date := v_current_date + 1;
    END LOOP;
  END LOOP;
END;
$function$;
