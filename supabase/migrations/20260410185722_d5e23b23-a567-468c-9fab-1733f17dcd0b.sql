
-- Epic 3: Allow staff to delete whatsapp messages
CREATE POLICY "Staff can delete whatsapp messages"
ON public.whatsapp_messages
FOR DELETE
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
);

-- Epic 8: Add assigned_to column for staff assignment
ALTER TABLE public.whatsapp_chat_settings
ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);
