-- Add GST fields to membership_plans
ALTER TABLE public.membership_plans
ADD COLUMN IF NOT EXISTS gst_rate numeric DEFAULT 18,
ADD COLUMN IF NOT EXISTS is_gst_inclusive boolean DEFAULT true;

COMMENT ON COLUMN public.membership_plans.gst_rate IS 'GST percentage rate (e.g., 18 for 18%)';
COMMENT ON COLUMN public.membership_plans.is_gst_inclusive IS 'Whether the price includes GST or GST is added on top';

-- Add assigned trainer to members for general training
ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS assigned_trainer_id uuid REFERENCES public.trainers(id);

CREATE INDEX IF NOT EXISTS idx_members_assigned_trainer ON public.members(assigned_trainer_id);
COMMENT ON COLUMN public.members.assigned_trainer_id IS 'Trainer assigned for general training guidance';

-- Create trainer change requests table for member portal
CREATE TABLE IF NOT EXISTS public.trainer_change_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  current_trainer_id uuid REFERENCES public.trainers(id),
  requested_trainer_id uuid REFERENCES public.trainers(id),
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  review_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.trainer_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view trainer change requests" 
ON public.trainer_change_requests 
FOR SELECT 
USING (true);

CREATE POLICY "Members can create trainer change requests" 
ON public.trainer_change_requests 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Staff can update trainer change requests" 
ON public.trainer_change_requests 
FOR UPDATE 
USING (true);

CREATE INDEX IF NOT EXISTS idx_trainer_change_requests_member ON public.trainer_change_requests(member_id);
CREATE INDEX IF NOT EXISTS idx_trainer_change_requests_status ON public.trainer_change_requests(status);