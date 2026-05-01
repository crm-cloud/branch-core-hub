-- =====================================================
-- Feedback + Google Reviews honest tracking model
-- =====================================================

-- 1. Branches: per-branch Google review presence
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS google_review_link TEXT,
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS google_review_qr_url TEXT;

-- 2. Feedback: real request/tracking fields
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS google_review_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_review_request_channel TEXT
    CHECK (google_review_request_channel IS NULL OR google_review_request_channel IN ('whatsapp','sms','email','in_app')),
  ADD COLUMN IF NOT EXISTS google_review_request_status TEXT
    DEFAULT 'not_sent'
    CHECK (google_review_request_status IN ('not_sent','queued','sent','delivered','failed')),
  ADD COLUMN IF NOT EXISTS google_review_request_message_id UUID
    REFERENCES public.communication_logs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS google_review_link_clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_review_matched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_review_reply_status TEXT
    DEFAULT 'none'
    CHECK (google_review_reply_status IN ('none','drafted','replied','failed')),
  ADD COLUMN IF NOT EXISTS google_review_reply_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_for_testimonial BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_for_testimonial_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recovery_task_id UUID
    REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_branch_rating
  ON public.feedback (branch_id, rating);
CREATE INDEX IF NOT EXISTS idx_feedback_review_request_status
  ON public.feedback (branch_id, google_review_request_status);

-- 3. Google reviews fetched from API
CREATE TABLE IF NOT EXISTS public.google_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  google_review_id TEXT NOT NULL,
  reviewer_name TEXT,
  reviewer_photo_url TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  reply_text TEXT,
  replied_at TIMESTAMPTZ,
  google_created_at TIMESTAMPTZ,
  matched_feedback_id UUID REFERENCES public.feedback(id) ON DELETE SET NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, google_review_id)
);

ALTER TABLE public.google_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view google reviews"
  ON public.google_reviews FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

CREATE POLICY "Managers can update google reviews"
  ON public.google_reviews FOR UPDATE
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]));

CREATE INDEX IF NOT EXISTS idx_google_reviews_branch_created
  ON public.google_reviews (branch_id, google_created_at DESC);

CREATE TRIGGER trg_google_reviews_updated_at
  BEFORE UPDATE ON public.google_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Feedback Google review link click tracking
CREATE TABLE IF NOT EXISTS public.feedback_google_link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ip_hash TEXT,
  user_agent TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_google_link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert click records"
  ON public.feedback_google_link_clicks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Staff can view click records"
  ON public.feedback_google_link_clicks FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

CREATE INDEX IF NOT EXISTS idx_feedback_link_clicks_feedback
  ON public.feedback_google_link_clicks (feedback_id);

-- 5. Trigger: low-rating recovery + queue review request flag
CREATE OR REPLACE FUNCTION public.handle_new_feedback()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_name TEXT;
  v_manager_id UUID;
  v_task_id UUID;
BEGIN
  -- Resolve member display name (best effort)
  IF NEW.member_id IS NOT NULL THEN
    SELECT COALESCE(p.full_name, m.member_code)
      INTO v_member_name
      FROM public.members m
      LEFT JOIN public.profiles p ON p.id = m.user_id
     WHERE m.id = NEW.member_id;
  END IF;

  IF NEW.rating IS NOT NULL AND NEW.rating <= 3 THEN
    -- Find a manager for this branch (fallback: any owner/admin)
    SELECT ur.user_id INTO v_manager_id
      FROM public.user_roles ur
     WHERE ur.branch_id = NEW.branch_id
       AND ur.role = 'manager'::app_role
     LIMIT 1;

    IF v_manager_id IS NULL THEN
      SELECT ur.user_id INTO v_manager_id
        FROM public.user_roles ur
       WHERE ur.role IN ('owner'::app_role,'admin'::app_role)
       LIMIT 1;
    END IF;

    INSERT INTO public.tasks (
      branch_id, title, description, priority, status, due_date, assigned_to, assigned_by
    ) VALUES (
      NEW.branch_id,
      'Recovery: low feedback from ' || COALESCE(v_member_name,'member'),
      'A member submitted a ' || NEW.rating || '-star feedback (' || COALESCE(NEW.category,'general') ||
        '). Reach out within 24h to acknowledge and resolve. Feedback: ' || COALESCE(NEW.feedback_text,'(no comment)'),
      'high'::task_priority,
      'pending'::task_status,
      (CURRENT_DATE + INTERVAL '1 day')::date,
      v_manager_id,
      v_manager_id
    ) RETURNING id INTO v_task_id;

    NEW.recovery_task_id := v_task_id;
    NEW.google_review_request_status := 'not_sent';
  ELSIF NEW.rating IS NOT NULL AND NEW.rating >= 4 THEN
    -- Mark queued; an edge function or admin action performs the actual send
    NEW.google_review_request_status := COALESCE(NEW.google_review_request_status, 'queued');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_routing ON public.feedback;
CREATE TRIGGER trg_feedback_routing
  BEFORE INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_feedback();
