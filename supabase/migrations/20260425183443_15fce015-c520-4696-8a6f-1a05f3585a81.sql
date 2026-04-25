
-- ============================================================
-- PART A: Communication retry queue
-- ============================================================

CREATE TABLE IF NOT EXISTS public.communication_retry_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_log_id uuid REFERENCES public.communication_logs(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('email','sms','whatsapp')),
  recipient text NOT NULL,
  subject text,
  content text NOT NULL,
  template_id uuid,
  member_id uuid,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','succeeded','exhausted','cancelled')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  succeeded_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid
);

CREATE INDEX IF NOT EXISTS idx_retry_queue_pending
  ON public.communication_retry_queue (next_retry_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_retry_queue_branch
  ON public.communication_retry_queue (branch_id, status);

ALTER TABLE public.communication_retry_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view retry queue" ON public.communication_retry_queue;
CREATE POLICY "Staff can view retry queue" ON public.communication_retry_queue
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]));

DROP POLICY IF EXISTS "Staff can update retry queue" ON public.communication_retry_queue;
CREATE POLICY "Staff can update retry queue" ON public.communication_retry_queue
  FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_retry_queue_updated_at ON public.communication_retry_queue;
CREATE TRIGGER trg_retry_queue_updated_at
  BEFORE UPDATE ON public.communication_retry_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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
    last_error, status
  ) VALUES (
    NEW.id, NEW.branch_id, NEW.type, NEW.recipient, NEW.subject, NEW.content,
    NEW.template_id, NEW.member_id, 0, 3, now() + interval '5 minutes',
    NEW.error_message, 'pending'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_failed_communication_ins ON public.communication_logs;
CREATE TRIGGER trg_enqueue_failed_communication_ins
  AFTER INSERT ON public.communication_logs
  FOR EACH ROW
  WHEN (NEW.status = 'failed')
  EXECUTE FUNCTION public.fn_enqueue_failed_communication();

DROP TRIGGER IF EXISTS trg_enqueue_failed_communication_upd ON public.communication_logs;
CREATE TRIGGER trg_enqueue_failed_communication_upd
  AFTER UPDATE OF status ON public.communication_logs
  FOR EACH ROW
  WHEN (NEW.status = 'failed' AND OLD.status IS DISTINCT FROM 'failed')
  EXECUTE FUNCTION public.fn_enqueue_failed_communication();

-- ============================================================
-- PART B: WhatsApp AI memory + lead linkage columns
-- ============================================================

ALTER TABLE public.whatsapp_chat_settings
  ADD COLUMN IF NOT EXISTS captured_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conversation_summary text,
  ADD COLUMN IF NOT EXISTS summary_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS summary_message_count integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_chat_settings_captured_lead
  ON public.whatsapp_chat_settings (captured_lead_id)
  WHERE captured_lead_id IS NOT NULL;

-- ============================================================
-- PART C: Cleanup duplicate whatsapp_ai leads, backfill captured_lead_id
-- ============================================================

UPDATE public.whatsapp_chat_settings cs
SET captured_lead_id = l.id
FROM (
  SELECT DISTINCT ON (phone, branch_id) id, phone, branch_id
  FROM public.leads
  WHERE source = 'whatsapp_ai' AND phone IS NOT NULL AND branch_id IS NOT NULL
  ORDER BY phone, branch_id, created_at ASC
) l
WHERE cs.phone_number = l.phone
  AND cs.branch_id    = l.branch_id
  AND cs.captured_lead_id IS NULL;

WITH ranked AS (
  SELECT id, phone, branch_id,
         ROW_NUMBER() OVER (PARTITION BY phone, branch_id ORDER BY created_at ASC) AS rn
  FROM public.leads
  WHERE source = 'whatsapp_ai'
    AND phone IS NOT NULL
    AND branch_id IS NOT NULL
)
UPDATE public.leads l
SET status = 'lost'::lead_status,
    notes  = COALESCE(l.notes,'') ||
             E'\n[Auto-merged duplicate of older whatsapp_ai lead on ' || now()::date || ']'
FROM ranked r
WHERE l.id = r.id
  AND r.rn > 1
  AND l.status NOT IN ('converted'::lead_status,'lost'::lead_status);

-- ============================================================
-- PART D: Partial unique index to block future duplicates
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_whatsapp_ai_phone_branch
  ON public.leads (phone, branch_id)
  WHERE source = 'whatsapp_ai' AND status NOT IN ('lost'::lead_status,'converted'::lead_status);
