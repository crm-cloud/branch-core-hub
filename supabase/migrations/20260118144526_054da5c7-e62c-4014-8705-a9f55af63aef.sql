-- Add RLS policies for member feedback submission
-- Allow members to insert their own feedback
CREATE POLICY "Members can submit feedback" ON feedback
FOR INSERT TO authenticated
WITH CHECK (
  member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
);

-- Allow members to view their own feedback
CREATE POLICY "Members can view own feedback" ON feedback
FOR SELECT TO authenticated
USING (
  member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  OR public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[])
);