-- Update enqueue trigger to copy delivery_metadata into communication_retry_queue.metadata
CREATE OR REPLACE FUNCTION public.fn_enqueue_failed_communication()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
BEGIN
  IF NEW.status NOT IN ('failed') THEN
    RETURN NEW;
  END IF;
  IF NEW.recipient IS NULL OR NEW.content IS NULL OR NEW.type IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing
    FROM public.communication_retry_queue
    WHERE original_log_id = NEW.id AND status IN ('pending','processing')
    LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN NEW; END IF;

  INSERT INTO public.communication_retry_queue (
    original_log_id, branch_id, type, recipient, subject, content,
    template_id, member_id, retry_count, max_retries, next_retry_at,
    last_error, status, metadata
  ) VALUES (
    NEW.id, NEW.branch_id, NEW.type, NEW.recipient, NEW.subject, NEW.content,
    NEW.template_id, NEW.member_id, 0, 3, now() + interval '5 minutes',
    NEW.error_message, 'pending',
    COALESCE(
      jsonb_build_object('category', NEW.category) ||
      COALESCE(NEW.delivery_metadata, '{}'::jsonb),
      '{}'::jsonb
    )
  );
  RETURN NEW;
END;
$$;