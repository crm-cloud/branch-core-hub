import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadInsert = Database['public']['Tables']['leads']['Insert'];
type LeadStatus = Database['public']['Enums']['lead_status'];

async function checkAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export const leadService = {
  async fetchLeads(branchId?: string) {
    const user = await checkAuth();
    if (!user) return [];

    let query = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
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

  async createLead(lead: LeadInsert) {
    const user = await checkAuth();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('leads')
      .insert(lead)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateLead(leadId: string, updates: Partial<Lead>) {
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

  async updateLeadStatus(leadId: string, status: LeadStatus) {
    return this.updateLead(leadId, { status });
  },

  async fetchFollowups(leadId: string) {
    const user = await checkAuth();
    if (!user) return [];

    const { data, error } = await supabase
      .from('lead_followups')
      .select('*')
      .eq('lead_id', leadId)
      .order('followup_date', { ascending: false });
    if (error) throw error;
    return data;
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

  async convertToMember(leadId: string, branchId: string) {
    const user = await checkAuth();
    if (!user) throw new Error('Not authenticated');

    // Fetch the lead first
    const lead = await this.fetchLeadById(leadId);
    if (!lead) throw new Error('Lead not found');
    
    // Generate member code
    const memberCode = `MEM${Date.now().toString(36).toUpperCase()}`;
    
    // Create member from lead
    const { data: member, error: memberError } = await supabase
      .from('members')
      .insert({
        branch_id: branchId,
        member_code: memberCode,
        lead_id: leadId,
        status: 'active',
        source: lead.source || 'lead_conversion',
      })
      .select()
      .single();
    
    if (memberError) throw memberError;
    
    // Update lead status to converted
    await supabase
      .from('leads')
      .update({
        status: 'converted',
        converted_at: new Date().toISOString(),
        converted_member_id: member.id,
      })
      .eq('id', leadId);
    
    return member;
  },

  async getLeadStats(branchId?: string) {
    const user = await checkAuth();
    if (!user) return { total: 0, new: 0, contacted: 0, interested: 0, converted: 0, lost: 0 };

    let query = supabase.from('leads').select('status');
    if (branchId) query = query.eq('branch_id', branchId);
    
    const { data, error } = await query;
    if (error) throw error;
    
    const stats = {
      total: data?.length || 0,
      new: 0,
      contacted: 0,
      interested: 0,
      converted: 0,
      lost: 0,
    };
    
    data?.forEach((lead) => {
      const status = lead.status as keyof typeof stats;
      if (status in stats) {
        stats[status]++;
      }
    });
    
    return stats;
  },
};
