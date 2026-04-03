
-- Fix rewards_ledger: restrict reads to own records or staff
DROP POLICY IF EXISTS "Authenticated users can read rewards_ledger" ON public.rewards_ledger;

CREATE POLICY "Staff can read all rewards_ledger"
ON public.rewards_ledger
FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[]));

CREATE POLICY "Members can read own rewards_ledger"
ON public.rewards_ledger
FOR SELECT
TO authenticated
USING (member_id = public.get_member_id(auth.uid()));
