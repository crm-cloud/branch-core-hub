import { supabase } from '@/integrations/supabase/client';

async function checkAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export interface LeadFilters {
  branchId?: string;
  status?: string[];
  temperature?: string[];
  source?: string;
  ownerId?: string;
  search?: string;
  tags?: string[];
}

export const leadService = {
  async fetchLeads(branchId?: string, filters?: LeadFilters) {
    const user = await checkAuth();
    if (!user) return [];

    let query = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    const effectiveBranchId = filters?.branchId || branchId;
    if (effectiveBranchId) {
      query = query.eq('branch_id', effectiveBranchId);
    }

    if (filters?.status?.length) {
      query = query.in('status', filters.status as any);
    }
    if (filters?.temperature?.length) {
      query = query.in('temperature', filters.temperature);
    }
    if (filters?.source && filters.source !== 'all') {
      query = query.eq('source', filters.source);
    }
    if (filters?.ownerId) {
      if (filters.ownerId === 'unassigned') {
        query = query.is('owner_id', null);
      } else {
        query = query.eq('owner_id', filters.ownerId);
      }
    }
    if (filters?.search) {
      const s = `%${filters.search}%`;
      query = query.or(`full_name.ilike.${s},phone.ilike.${s},email.ilike.${s}`);
    }

    // Filter out merged leads
    query = query.is('merged_into', null);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async fetchLeadById(leadId: string) {
    const user = await checkAuth();
    if (!user) return null;

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createLead(lead: any) {
    const user = await checkAuth();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('leads')
      .insert(lead)
      .select()
      .single();
    if (error) throw error;

    // Log activity
    if (data) {
      await supabase.from('lead_activities').insert({
        lead_id: data.id,
        branch_id: data.branch_id,
        actor_id: user.id,
        activity_type: 'created',
        title: 'Lead created',
        notes: `Source: ${data.source || 'direct'}`,
      });
    }

    return data;
  },

  async updateLead(leadId: string, updates: any) {
    const user = await checkAuth();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', leadId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateLeadStatus(leadId: string, status: string, reason?: string) {
    const user = await checkAuth();
    if (!user) throw new Error('Not authenticated');

    const updates: any = { status };
    if (status === 'lost' && reason) updates.lost_reason = reason;
    if (status === 'converted') updates.won_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', leadId)
      .select()
      .single();
    if (error) throw error;

    // Log activity
    if (data) {
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        branch_id: data.branch_id,
        actor_id: user.id,
        activity_type: 'status_change',
        title: `Status changed to ${status}`,
        metadata: { from: undefined, to: status, reason },
      });
    }

    return data;
  },

  async assignLead(leadId: string, ownerId: string | null) {
    const user = await checkAuth();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('leads')
      .update({ owner_id: ownerId })
      .eq('id', leadId)
      .select()
      .single();
    if (error) throw error;

    if (data) {
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        branch_id: data.branch_id,
        actor_id: user.id,
        activity_type: 'assignment',
        title: ownerId ? 'Lead assigned' : 'Lead unassigned',
        metadata: { owner_id: ownerId },
      });
    }

    return data;
  },

  async updateLeadScore(leadId: string, score: number) {
    return this.updateLead(leadId, { score: Math.max(0, Math.min(100, score)) });
  },

  async updateLeadTemperature(leadId: string, temperature: string) {
    const user = await checkAuth();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('leads')
      .update({ temperature })
      .eq('id', leadId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Activities
  async fetchLeadActivities(leadId: string) {
    const user = await checkAuth();
    if (!user) return [];

    const { data, error } = await supabase
      .from('lead_activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createActivity(activity: {
    lead_id: string;
    branch_id: string;
    activity_type: string;
    title?: string;
    notes?: string;
    metadata?: any;
  }) {
    const user = await checkAuth();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('lead_activities')
      .insert({ ...activity, actor_id: user.id })
      .select()
      .single();
    if (error) throw error;

    // Update last_contacted_at for contact activities
    if (['call', 'whatsapp', 'email', 'visit', 'sms'].includes(activity.activity_type)) {
      const contactUpdate: any = { last_contacted_at: new Date().toISOString() };
      // Set first_response_at if not already set
      const lead = await this.fetchLeadById(activity.lead_id);
      if (lead && !lead.first_response_at) {
        contactUpdate.first_response_at = new Date().toISOString();
      }
      await supabase.from('leads').update(contactUpdate).eq('id', activity.lead_id);
    }

    return data;
  },

  // Legacy followups support (read-only)
  async fetchFollowups(leadId: string) {
    const user = await checkAuth();
    if (!user) return [];

    const { data, error } = await supabase
      .from('lead_followups')
      .select('*')
      .eq('lead_id', leadId)
      .order('followup_date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createFollowup(followup: {
    lead_id: string;
    followup_date: string;
    notes?: string;
    outcome?: string;
    next_followup_date?: string;
  }) {
    const user = await checkAuth();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('lead_followups')
      .insert(followup)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Duplicate detection
  async detectDuplicates(phone?: string, email?: string) {
    if (!phone && !email) return [];
    const user = await checkAuth();
    if (!user) return [];

    let query = supabase.from('leads').select('id, full_name, phone, email, status, branch_id');

    if (phone && email) {
      query = query.or(`phone.eq.${phone},email.eq.${email}`);
    } else if (phone) {
      query = query.eq('phone', phone);
    } else if (email) {
      query = query.eq('email', email!);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async convertToMember(leadId: string, branchId: string) {
    const user = await checkAuth();
    if (!user) throw new Error('Not authenticated');

    const lead = await this.fetchLeadById(leadId);
    if (!lead) throw new Error('Lead not found');

    // Use email if available, otherwise let edge function handle it
    const email = lead.email || `member-${leadId.slice(0, 8)}@placeholder.local`;

    const { data, error } = await supabase.functions.invoke('create-member-user', {
      body: {
        email,
        fullName: lead.full_name || 'Unknown',
        phone: lead.phone || null,
        branchId,
        source: lead.source || 'lead_conversion',
      },
    });

    if (error) throw new Error(`Lead conversion failed: ${error.message || JSON.stringify(error)}`);
    if (data?.error) throw new Error(`Lead conversion failed: ${data.error}${data.details ? ' — ' + data.details : ''}`);

    await supabase
      .from('leads')
      .update({
        status: 'converted',
        converted_at: new Date().toISOString(),
        converted_member_id: data.memberId,
        won_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    // Log conversion activity
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      branch_id: branchId,
      actor_id: user.id,
      activity_type: 'conversion',
      title: 'Converted to member',
      metadata: { member_id: data.memberId },
    });

    return data;
  },

  async getLeadStats(branchId?: string) {
    const user = await checkAuth();
    if (!user) return { total: 0, new: 0, contacted: 0, qualified: 0, negotiation: 0, converted: 0, lost: 0, hot: 0, warm: 0, cold: 0, unassigned: 0 };

    let query = supabase.from('leads').select('status, temperature, owner_id').is('merged_into', null);
    if (branchId) query = query.eq('branch_id', branchId);

    const { data, error } = await query;
    if (error) throw error;

    const stats = {
      total: data?.length || 0,
      new: 0, contacted: 0, qualified: 0, negotiation: 0, converted: 0, lost: 0,
      hot: 0, warm: 0, cold: 0,
      unassigned: 0,
    };

    data?.forEach((lead: any) => {
      if (lead.status in stats) (stats as any)[lead.status]++;
      if (lead.temperature in stats) (stats as any)[lead.temperature]++;
      if (!lead.owner_id) stats.unassigned++;
    });

    return stats;
  },
};
