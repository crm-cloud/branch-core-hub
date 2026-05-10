
-- channel_active_for_branch: returns TRUE only when an active integration row
-- exists for the given channel (branch-scoped first, global fallback).
-- in_app is always allowed (internal notifications table).
CREATE OR REPLACE FUNCTION public.channel_active_for_branch(
  p_branch_id uuid,
  p_channel text
) RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_found boolean;
BEGIN
  IF p_channel = 'in_app' THEN
    RETURN TRUE;
  END IF;

  v_type := CASE p_channel
    WHEN 'whatsapp' THEN 'whatsapp'
    WHEN 'sms'      THEN 'sms'
    WHEN 'email'    THEN 'email'
    ELSE NULL
  END;

  IF v_type IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Branch-scoped active row wins
  IF p_branch_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.integration_settings
      WHERE branch_id = p_branch_id
        AND integration_type = v_type
        AND is_active = TRUE
    ) INTO v_found;
    IF v_found THEN RETURN TRUE; END IF;

    -- If a branch row exists but inactive, treat branch as kill-switch
    SELECT EXISTS (
      SELECT 1 FROM public.integration_settings
      WHERE branch_id = p_branch_id
        AND integration_type = v_type
    ) INTO v_found;
    IF v_found THEN RETURN FALSE; END IF;
  END IF;

  -- Global fallback
  SELECT EXISTS (
    SELECT 1 FROM public.integration_settings
    WHERE branch_id IS NULL
      AND integration_type = v_type
      AND is_active = TRUE
  ) INTO v_found;

  RETURN COALESCE(v_found, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.channel_active_for_branch(uuid, text) TO authenticated, service_role, anon;

-- Extend should_send_communication: also block when channel integration is off.
-- Adds optional p_branch_id arg without breaking existing 3-arg callers.
CREATE OR REPLACE FUNCTION public.should_send_communication(
  p_member_id uuid,
  p_channel text,
  p_category text,
  p_branch_id uuid DEFAULT NULL
) RETURNS TABLE(allowed boolean, reason text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs public.member_communication_preferences;
BEGIN
  -- Branch-level integration kill switch (applies to ALL categories incl. transactional).
  IF p_branch_id IS NOT NULL AND p_channel <> 'in_app' THEN
    IF NOT public.channel_active_for_branch(p_branch_id, p_channel) THEN
      RETURN QUERY SELECT FALSE, 'channel_disabled_in_settings'; RETURN;
    END IF;
  END IF;

  IF p_category = 'transactional' THEN
    RETURN QUERY SELECT TRUE, NULL::text; RETURN;
  END IF;

  IF p_channel = 'in_app' THEN
    RETURN QUERY SELECT TRUE, NULL::text; RETURN;
  END IF;

  IF p_member_id IS NULL THEN
    RETURN QUERY SELECT TRUE, NULL::text; RETURN;
  END IF;

  SELECT * INTO v_prefs
  FROM public.member_communication_preferences
  WHERE member_id = p_member_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT TRUE, NULL::text; RETURN;
  END IF;

  IF p_channel = 'whatsapp' AND NOT v_prefs.whatsapp_enabled THEN
    RETURN QUERY SELECT FALSE, 'whatsapp_disabled'; RETURN;
  END IF;
  IF p_channel = 'sms' AND NOT v_prefs.sms_enabled THEN
    RETURN QUERY SELECT FALSE, 'sms_disabled'; RETURN;
  END IF;
  IF p_channel = 'email' AND NOT v_prefs.email_enabled THEN
    RETURN QUERY SELECT FALSE, 'email_disabled'; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.should_send_communication(uuid, text, text, uuid) TO authenticated, service_role, anon;
