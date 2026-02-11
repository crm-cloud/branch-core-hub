
-- Allow members to create invoices for themselves (store purchases)
CREATE POLICY "Members can create store invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = public.get_member_id(auth.uid())
  );

-- Allow members to add items to their own invoices
CREATE POLICY "Members can create own invoice items" ON public.invoice_items
  FOR INSERT TO authenticated
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM public.invoices
      WHERE member_id = public.get_member_id(auth.uid())
    )
  );
