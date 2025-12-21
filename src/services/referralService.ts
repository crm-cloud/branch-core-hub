import { supabase } from '@/integrations/supabase/client';
import { creditWallet } from './walletService';

async function checkAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function fetchMemberReferrals(memberId: string) {
  const user = await checkAuth();
  if (!user) return [];

  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_member_id', memberId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function fetchAllReferrals() {
  const user = await checkAuth();
  if (!user) return [];

  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function fetchMemberRewards(memberId: string) {
  const user = await checkAuth();
  if (!user) return [];

  const { data, error } = await supabase
    .from('referral_rewards')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function claimReward(rewardId: string, memberId: string) {
  const user = await checkAuth();
  if (!user) throw new Error('Not authenticated');

  const { data: reward, error: rewardError } = await supabase
    .from('referral_rewards')
    .select('*')
    .eq('id', rewardId)
    .eq('member_id', memberId)
    .eq('is_claimed', false)
    .maybeSingle();

  if (rewardError) throw rewardError;
  if (!reward) throw new Error('Reward not found or already claimed');

  if (reward.reward_type === 'wallet_credit' && reward.reward_value) {
    await creditWallet(memberId, reward.reward_value, 'Referral reward claimed', 'referral', rewardId);
  }

  const { data, error } = await supabase
    .from('referral_rewards')
    .update({ is_claimed: true, claimed_at: new Date().toISOString() })
    .eq('id', rewardId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
