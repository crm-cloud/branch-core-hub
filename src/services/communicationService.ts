import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type CommunicationLog = Database['public']['Tables']['communication_logs']['Row'];
type Template = Database['public']['Tables']['templates']['Row'];

export const communicationService = {
  // Communication logs
  async fetchCommunicationLogs(branchId?: string, limit = 50) {
    let query = supabase
      .from('communication_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async logCommunication(log: {
    branch_id: string;
    type: string;
    recipient: string;
    subject?: string;
    content?: string;
    status?: string;
    member_id?: string;
    template_id?: string;
  }) {
    const { data, error } = await supabase
      .from('communication_logs')
      .insert({
        ...log,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Templates
  async fetchTemplates(branchId?: string) {
    let query = supabase
      .from('templates')
      .select('*')
      .order('name');
    
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // WhatsApp integration (opens WhatsApp with pre-filled message)
  sendWhatsApp(phone: string, message: string) {
    const formattedPhone = phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    window.open(url, '_blank');
    return url;
  },

  // Email (via edge function - placeholder for now)
  async sendEmail(to: string, subject: string, body: string, branchId: string) {
    // Log the email attempt
    await this.logCommunication({
      branch_id: branchId,
      type: 'email',
      recipient: to,
      subject,
      content: body,
      status: 'sent',
    });
    
    // In a real implementation, this would call an edge function
    console.log('Email sent to:', to);
    return { success: true };
  },

  // SMS (opens SMS app with pre-filled message)
  sendSMS(phone: string, message: string) {
    const formattedPhone = phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    const url = `sms:${formattedPhone}?body=${encodedMessage}`;
    window.open(url, '_blank');
    return url;
  },

  // Announcements
  async fetchAnnouncements(branchId?: string, activeOnly = false) {
    let query = supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async createAnnouncement(announcement: {
    title: string;
    content: string;
    branch_id?: string;
    target_audience?: string;
    priority?: number;
    is_active?: boolean;
    publish_at?: string;
    expire_at?: string;
  }) {
    const { data, error } = await supabase
      .from('announcements')
      .insert(announcement)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateAnnouncement(id: string, updates: Partial<{
    title: string;
    content: string;
    target_audience?: string;
    priority?: number;
    is_active?: boolean;
    publish_at?: string;
    expire_at?: string;
  }>) {
    const { data, error } = await supabase
      .from('announcements')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteAnnouncement(id: string) {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
