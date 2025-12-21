-- Create feedback table for member feedback workflow
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  trainer_id UUID REFERENCES public.trainers(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  feedback_text TEXT,
  category TEXT DEFAULT 'general' CHECK (category IN ('service', 'trainer', 'facility', 'cleanliness', 'equipment', 'general')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for feedback
CREATE POLICY "Staff can view branch feedback"
ON public.feedback
FOR SELECT
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]) OR
  public.manages_branch(auth.uid(), branch_id) OR
  EXISTS (
    SELECT 1 FROM public.staff_branches sb
    WHERE sb.user_id = auth.uid() AND sb.branch_id = feedback.branch_id
  )
);

CREATE POLICY "Staff can insert branch feedback"
ON public.feedback
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]) OR
  public.manages_branch(auth.uid(), branch_id) OR
  EXISTS (
    SELECT 1 FROM public.staff_branches sb
    WHERE sb.user_id = auth.uid() AND sb.branch_id = feedback.branch_id
  )
);

CREATE POLICY "Staff can update branch feedback"
ON public.feedback
FOR UPDATE
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]) OR
  public.manages_branch(auth.uid(), branch_id)
);

CREATE POLICY "Admins can delete feedback"
ON public.feedback
FOR DELETE
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[])
);

-- Create trigger for updated_at
CREATE TRIGGER update_feedback_updated_at
BEFORE UPDATE ON public.feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();