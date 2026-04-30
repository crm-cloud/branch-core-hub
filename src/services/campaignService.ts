import { supabase } from '@/integrations/supabase/client';

export type CampaignChannel = 'whatsapp' | 'email' | 'sms';
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'paused';
export type CampaignTriggerType = 'send_now' | 'automated' | 'scheduled';

export interface AudienceFilter {
  status?: 'active' | 'lead' | 'expired' | 'all';
  goal?: string | null;
  last_attendance_before?: string | null; // ISO date — "no visit since"
  last_attendance_after?: string | null;
}

export interface Campaign {
  id: string;
  branch_id: string;
  name: string;
  channel: CampaignChannel;
  audience_filter: AudienceFilter;
  message: string;
  subject: string | null;
  trigger_type: CampaignTriggerType;
  status: CampaignStatus;
  recipients_count: number;
  success_count: number;
  failure_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}

/**
 * Resolves the actual member IDs that match the given audience filter.
 * Used both for the live count in the wizard AND for handing the
 * resolved list to send-broadcast on Send Now.
 */
export async function resolveAudienceMemberIds(
  branchId: string,
  filter: AudienceFilter
): Promise<{ memberIds: string[]; sample: Array<{ id: string; name: string }> }> {
  let memberIds: string[] = [];

  // Status filter via memberships
  if (filter.status === 'active') {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('memberships')
      .select('member_id')
      .eq('branch_id', branchId)
      .eq('status', 'active')
      .gte('end_date', today);
    memberIds = [...new Set((data || []).map((m: any) => m.member_id))];
  } else if (filter.status === 'expired') {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('memberships')
      .select('member_id')
      .eq('branch_id', branchId)
      .lt('end_date', today);
    memberIds = [...new Set((data || []).map((m: any) => m.member_id))];
  } else {
    // 'all' or unset: pull every member in branch
    const { data } = await supabase
      .from('members')
      .select('id')
      .eq('branch_id', branchId);
    memberIds = (data || []).map((m: any) => m.id);
  }

  if (memberIds.length === 0) return { memberIds: [], sample: [] };

  // Goal filter
  if (filter.goal) {
    const { data } = await supabase
      .from('members')
      .select('id, fitness_goals')
      .in('id', memberIds);
    memberIds = (data || [])
      .filter((m: any) => (m.fitness_goals || '').toLowerCase().includes(filter.goal!.toLowerCase()))
      .map((m: any) => m.id);
  }

  // Last attendance window
  if (filter.last_attendance_before || filter.last_attendance_after) {
    const { data } = await supabase
      .from('member_attendance')
      .select('member_id, check_in')
      .in('member_id', memberIds)
      .order('check_in', { ascending: false });

    const lastByMember = new Map<string, string>();
    for (const row of data || []) {
      const r: any = row;
      if (!lastByMember.has(r.member_id)) lastByMember.set(r.member_id, r.check_in);
    }

    memberIds = memberIds.filter((id) => {
      const last = lastByMember.get(id);
      if (filter.last_attendance_before && (!last || new Date(last) >= new Date(filter.last_attendance_before))) return false;
      if (filter.last_attendance_after && (!last || new Date(last) <= new Date(filter.last_attendance_after))) return false;
      return true;
    });
  }

  // Sample for preview
  const { data: sampleData } = await supabase
    .from('members')
    .select('id, profiles:user_id(full_name)')
    .in('id', memberIds.slice(0, 5));
  const sample = (sampleData || []).map((m: any) => ({
    id: m.id,
    name: m.profiles?.full_name || 'Unknown',
  }));

  return { memberIds, sample };
}

export async function listCampaigns(branchId: string): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any) || [];
}

export async function createCampaign(input: Omit<Campaign,
  'id' | 'recipients_count' | 'success_count' | 'failure_count' | 'sent_at' | 'created_at' | 'status'
> & { status?: CampaignStatus }): Promise<Campaign> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      branch_id: input.branch_id,
      name: input.name,
      channel: input.channel,
      audience_filter: input.audience_filter as any,
      message: input.message,
      subject: input.subject,
      trigger_type: input.trigger_type,
      status: input.status || 'draft',
      scheduled_at: input.scheduled_at,
      created_by: user?.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

export async function sendCampaignNow(
  campaign: Campaign,
  memberIds: string[]
): Promise<{ sent: number; failed: number; total: number }> {
  await supabase.from('campaigns').update({ status: 'sending' }).eq('id', campaign.id);

  const { data, error } = await supabase.functions.invoke('send-broadcast', {
    body: {
      channel: campaign.channel,
      message: campaign.message,
      subject: campaign.subject,
      branch_id: campaign.branch_id,
      member_ids: memberIds,
      campaign_id: campaign.id,
    },
  });
  if (error) throw error;
  return data as any;
}
