import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadInsert = Database['public']['Tables']['leads']['Insert'];
type LeadStatus = Database['public']['Enums']['lead_status'];
type LeadFollowup = Database['public']['Tables']['lead_followups']['Row'];

export const leadService = {
  async fetchLeads(branchId?: string) {
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
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();
    if (error) throw error;
    return data;
  },

  async createLead(lead: LeadInsert) {
    const { data, error } = await supabase
      .from('leads')
      .insert(lead)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateLead(leadId: string, updates: Partial<Lead>) {
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
    const { data, error } = await supabase
      .from('lead_followups')
      .insert(followup)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async convertToMember(leadId: string, branchId: string) {
    // Fetch the lead first
    const lead = await this.fetchLeadById(leadId);
    
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
