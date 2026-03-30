
-- Rewards Ledger System
CREATE TABLE public.rewards_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  branch_id uuid REFERENCES public.branches(id),
  points integer NOT NULL,
  reason text NOT NULL,
  reference_type text,
  reference_id text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.rewards_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read rewards_ledger"
  ON public.rewards_ledger FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert rewards_ledger"
  ON public.rewards_ledger FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE public.members ADD COLUMN IF NOT EXISTS reward_points integer DEFAULT 0;

CREATE INDEX idx_rewards_ledger_member_id ON public.rewards_ledger(member_id);
