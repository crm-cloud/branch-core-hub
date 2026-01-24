import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type BenefitType = Database['public']['Enums']['benefit_type'];
type FrequencyType = Database['public']['Enums']['frequency_type'];

export interface BenefitUsage {
  id: string;
  membership_id: string;
  benefit_type: BenefitType;
  usage_date: string;
  usage_count: number;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface MemberBenefitBalance {
  benefit_type: BenefitType;
  frequency: FrequencyType;
  limit_count: number | null;
  description: string | null;
  used: number;
  remaining: number | null;
  isUnlimited: boolean;
}

export interface MembershipWithBenefits {
  id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  plan: {
    name: string;
    benefits: {
      benefit_type: BenefitType;
      frequency: FrequencyType;
      limit_count: number | null;
      description: string | null;
    }[];
  };
}

// Fetch member's active membership with plan benefits
export async function fetchMembershipWithBenefits(memberId: string): Promise<MembershipWithBenefits | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select(`
      id,
      plan_id,
      start_date,
      end_date,
      membership_plans!inner(
        name,
        plan_benefits(
          benefit_type,
          frequency,
          limit_count,
          description
        )
      )
    `)
    .eq('member_id', memberId)
    .eq('status', 'active')
    .gte('end_date', new Date().toISOString().split('T')[0])
    .order('end_date', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    plan_id: data.plan_id,
    start_date: data.start_date,
    end_date: data.end_date,
    plan: {
      name: (data.membership_plans as any).name,
      benefits: (data.membership_plans as any).plan_benefits || [],
    },
  };
}

// Fetch benefit usage records for a membership
export async function fetchBenefitUsage(membershipId: string): Promise<BenefitUsage[]> {
  const { data, error } = await supabase
    .from('benefit_usage')
    .select('*')
    .eq('membership_id', membershipId)
    .order('usage_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Calculate remaining benefits based on frequency
export function calculateBenefitBalances(
  benefits: MembershipWithBenefits['plan']['benefits'],
  usageRecords: BenefitUsage[],
  membershipStartDate: string
): MemberBenefitBalance[] {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return benefits.map(benefit => {
    // Filter usage based on frequency period
    let relevantUsage = usageRecords.filter(u => u.benefit_type === benefit.benefit_type);

    switch (benefit.frequency) {
      case 'daily':
        relevantUsage = relevantUsage.filter(u => 
          new Date(u.usage_date) >= startOfDay
        );
        break;
      case 'weekly':
        relevantUsage = relevantUsage.filter(u => 
          new Date(u.usage_date) >= startOfWeek
        );
        break;
      case 'monthly':
        relevantUsage = relevantUsage.filter(u => 
          new Date(u.usage_date) >= startOfMonth
        );
        break;
      case 'per_membership':
        // For per_membership, count ALL usage from membership start to end (total pool)
        relevantUsage = relevantUsage.filter(u => 
          new Date(u.usage_date) >= new Date(membershipStartDate)
        );
        break;
      case 'unlimited':
        // No filtering needed for unlimited
        break;
    }

    const used = relevantUsage.reduce((sum, u) => sum + (u.usage_count || 1), 0);
    const isUnlimited = benefit.frequency === 'unlimited' || benefit.limit_count === null;
    const remaining = isUnlimited ? null : Math.max(0, (benefit.limit_count || 0) - used);

    return {
      benefit_type: benefit.benefit_type,
      frequency: benefit.frequency,
      limit_count: benefit.limit_count,
      description: benefit.description,
      used,
      remaining,
      isUnlimited,
    };
  });
}

// Record a benefit usage
export async function recordBenefitUsage(
  membershipId: string,
  benefitType: BenefitType,
  usageCount: number = 1,
  notes?: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await supabase
    .from('benefit_usage')
    .insert({
      membership_id: membershipId,
      benefit_type: benefitType,
      usage_date: new Date().toISOString().split('T')[0],
      usage_count: usageCount,
      notes: notes || null,
      recorded_by: user?.id || null,
    });

  if (error) throw error;
}

// Get benefit usage history for a membership
export async function fetchBenefitUsageHistory(
  membershipId: string,
  benefitType?: BenefitType,
  limit: number = 50
): Promise<(BenefitUsage & { recorded_by_name?: string })[]> {
  let query = supabase
    .from('benefit_usage')
    .select(`
      *,
      profiles:recorded_by(full_name)
    `)
    .eq('membership_id', membershipId)
    .order('usage_date', { ascending: false })
    .limit(limit);

  if (benefitType) {
    query = query.eq('benefit_type', benefitType);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((record: any) => ({
    ...record,
    recorded_by_name: record.profiles?.full_name,
  }));
}

// Validate if a benefit can be used (not exceeded limit)
export async function validateBenefitUsage(
  membershipId: string,
  benefitType: BenefitType
): Promise<{ valid: boolean; message?: string; remaining?: number }> {
  const membership = await supabase
    .from('memberships')
    .select(`
      id,
      start_date,
      end_date,
      membership_plans!inner(
        plan_benefits(
          benefit_type,
          frequency,
          limit_count
        )
      )
    `)
    .eq('id', membershipId)
    .single();

  if (membership.error || !membership.data) {
    return { valid: false, message: 'Membership not found' };
  }

  const planBenefits = (membership.data.membership_plans as any).plan_benefits || [];
  const benefit = planBenefits.find((b: any) => b.benefit_type === benefitType);

  if (!benefit) {
    return { valid: false, message: 'Benefit not included in plan' };
  }

  // Unlimited benefits always valid
  if (benefit.frequency === 'unlimited' || benefit.limit_count === null) {
    return { valid: true };
  }

  // Get usage records
  const usageRecords = await fetchBenefitUsage(membershipId);
  const balances = calculateBenefitBalances(
    planBenefits,
    usageRecords,
    membership.data.start_date
  );

  const balance = balances.find(b => b.benefit_type === benefitType);
  
  if (!balance || (balance.remaining !== null && balance.remaining <= 0)) {
    return { valid: false, message: 'Benefit limit reached for this period', remaining: 0 };
  }

  return { valid: true, remaining: balance.remaining ?? undefined };
}

// Benefit type display names
export const benefitTypeLabels: Record<BenefitType, string> = {
  gym_access: 'Gym Access',
  group_classes: 'Group Classes',
  pt_sessions: 'PT Sessions',
  pool_access: 'Swimming Pool',
  sauna_session: 'Sauna Session',
  sauna_access: 'Sauna Access',
  steam_access: 'Steam Access',
  locker: 'Locker',
  towel: 'Towel Service',
  parking: 'Parking',
  guest_pass: 'Guest Pass',
  ice_bath: 'Ice Bath',
  yoga_class: 'Yoga Class',
  crossfit_class: 'CrossFit Class',
  spa_access: 'Spa Access',
  cardio_area: 'Cardio Area',
  functional_training: 'Functional Training',
  other: 'Other',
};

// Frequency display names
export const frequencyLabels: Record<FrequencyType, string> = {
  daily: 'Per Day',
  weekly: 'Per Week',
  monthly: 'Per Month',
  unlimited: 'Unlimited',
  per_membership: 'Total for Membership',
};
