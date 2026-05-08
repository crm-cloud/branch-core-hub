
-- Enable trigram fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Inbound Google reviews
CREATE TABLE IF NOT EXISTS public.google_reviews_inbound (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  google_review_id TEXT NOT NULL UNIQUE,
  author_name TEXT,
  author_photo_url TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  language TEXT,
  posted_at TIMESTAMPTZ,
  google_reply_text TEXT,
  google_reply_updated_at TIMESTAMPTZ,
  match_type TEXT CHECK (match_type IN ('member','lead','none')) DEFAULT 'none',
  matched_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  matched_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  match_confidence NUMERIC,
  match_evidence JSONB DEFAULT '{}'::jsonb,
  ai_classification TEXT CHECK (ai_classification IN ('genuine','unhappy_member','suspected_fake','spam','pending')) DEFAULT 'pending',
  ai_reasoning TEXT,
  ai_draft_reply TEXT,
  ai_classified_at TIMESTAMPTZ,
  reply_status TEXT CHECK (reply_status IN ('draft','approved','sent','reported','dismissed')) DEFAULT 'draft',
  reply_text TEXT,
  replied_by UUID,
  replied_at TIMESTAMPTZ,
  reported_to_google_at TIMESTAMPTZ,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gri_branch_posted ON public.google_reviews_inbound(branch_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_gri_reply_status ON public.google_reviews_inbound(reply_status);
CREATE INDEX IF NOT EXISTS idx_gri_classification ON public.google_reviews_inbound(ai_classification);
CREATE INDEX IF NOT EXISTS idx_gri_author_trgm ON public.google_reviews_inbound USING gin (author_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_full_name_trgm ON public.leads USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm ON public.profiles USING gin (full_name gin_trgm_ops);

ALTER TABLE public.google_reviews_inbound ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view branch external reviews"
ON public.google_reviews_inbound FOR SELECT TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]) OR
  public.manages_branch(auth.uid(), branch_id) OR
  EXISTS (SELECT 1 FROM public.staff_branches sb WHERE sb.user_id = auth.uid() AND sb.branch_id = google_reviews_inbound.branch_id)
);

CREATE POLICY "Staff can update branch external reviews"
ON public.google_reviews_inbound FOR UPDATE TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]) OR
  public.manages_branch(auth.uid(), branch_id) OR
  EXISTS (SELECT 1 FROM public.staff_branches sb WHERE sb.user_id = auth.uid() AND sb.branch_id = google_reviews_inbound.branch_id)
);

CREATE POLICY "Admins delete external reviews"
ON public.google_reviews_inbound FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']::app_role[]));

-- Service role inserts via edge function (no INSERT policy needed for service role)

CREATE TRIGGER trg_gri_updated_at
BEFORE UPDATE ON public.google_reviews_inbound
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.google_reviews_inbound;
