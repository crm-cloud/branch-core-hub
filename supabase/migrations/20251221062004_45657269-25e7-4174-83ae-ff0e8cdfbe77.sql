-- Create referral_settings table for configurable rewards
CREATE TABLE public.referral_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES public.branches(id),
  referrer_reward_type TEXT NOT NULL DEFAULT 'wallet_credit',
  referrer_reward_value NUMERIC NOT NULL DEFAULT 500,
  referred_reward_type TEXT NOT NULL DEFAULT 'wallet_credit', 
  referred_reward_value NUMERIC NOT NULL DEFAULT 200,
  min_membership_value NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Staff can view referral settings" ON public.referral_settings
  FOR SELECT USING (true);

CREATE POLICY "Managers can manage referral settings" ON public.referral_settings
  FOR ALL USING (true);

-- Add referral_code column to referrals table if not exists
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Create index for referral code lookup
CREATE INDEX IF NOT EXISTS idx_referrals_referral_code ON public.referrals(referral_code);

-- Insert default settings
INSERT INTO public.referral_settings (referrer_reward_type, referrer_reward_value, referred_reward_type, referred_reward_value)
VALUES ('wallet_credit', 500, 'wallet_credit', 200);