import { supabase } from '@/integrations/supabase/client';

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

  // Atomic backend RPC — locks the reward, credits the wallet (if applicable),
  // marks claimed, and is idempotent. No client-side wallet credit step.
  const idempotencyKey = `claim-${rewardId}-${user.id}`;
  const { data, error } = await supabase.rpc('claim_referral_reward', {
    p_reward_id: rewardId,
    p_member_id: memberId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  const result = data as { success?: boolean; error?: string } | null;
  if (!result?.success) throw new Error(result?.error || 'Failed to claim reward');
  return result;
}
