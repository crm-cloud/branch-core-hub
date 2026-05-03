import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type CommunicationLog = Database['public']['Tables']['communication_logs']['Row'];
type Template = Database['public']['Tables']['templates']['Row'];

export const communicationService = {
  // Communication logs — branchId is REQUIRED (fail-closed scoping).
  // Owners viewing all branches must call fetchAllCommunicationLogsForOwner().
  async fetchCommunicationLogs(branchId: string, limit = 50) {
    if (!branchId) throw new Error('BRANCH_REQUIRED: communication logs must be branch-scoped');
    const { data, error } = await supabase
      .from('communication_logs')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  // Owner-only escape hatch — RLS still enforces is_owner/is_admin server-side.
  async fetchAllCommunicationLogsForOwner(limit = 50) {
    const { data, error } = await supabase
      .from('communication_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
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

  // Templates — branchId REQUIRED. Owners may use fetchAllTemplatesForOwner.
  async fetchTemplates(branchId: string) {
    if (!branchId) throw new Error('BRANCH_REQUIRED: templates must be branch-scoped');
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('branch_id', branchId)
      .order('name');

    if (error) throw error;
    return data;
  },

  async fetchAllTemplatesForOwner() {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  },

  // Broadcast via edge function
  async sendBroadcast(params: {
    channel: 'email' | 'sms' | 'whatsapp';
    message: string;
    audience: string;
    branch_id: string;
    subject?: string;
  }) {
    const { data, error } = await supabase.functions.invoke('send-broadcast', {
      body: params,
    });
    if (error) throw error;
    return data;
  },

  // Run automated reminders via edge function
  async runReminders() {
    const { data, error } = await supabase.functions.invoke('send-reminders', {
      body: {},
    });
    if (error) throw error;
    return data;
  },

  // WhatsApp integration (opens WhatsApp with pre-filled message)
  async sendWhatsApp(phone: string, message: string, options?: { branchId?: string; memberId?: string }) {
    const formattedPhone = phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    window.open(url, '_blank');
    // Log to communication_logs
    if (options?.branchId) {
      try {
        await this.logCommunication({
          branch_id: options.branchId,
          type: 'whatsapp',
          recipient: phone,
          content: message.slice(0, 500),
          status: 'sent',
          member_id: options.memberId,
        });
      } catch (e) {
        console.error('Failed to log WhatsApp communication:', e);
      }
    }
    return url;
  },

  // Email — routes through unified dispatcher (single source of truth).
  async sendEmail(to: string, subject: string, body: string, branchId: string) {
    const { dispatchCommunication, buildDedupeKey } = await import('@/lib/comms/dispatch');
    const result = await dispatchCommunication({
      branch_id: branchId,
      channel: 'email',
      category: 'transactional',
      recipient: to,
      payload: { subject, body, use_branded_template: true },
      dedupe_key: buildDedupeKey(['adhoc', subject, to, Date.now()]),
      force: true,
    });
    if (result.status === 'failed' || result.status === 'suppressed') {
      throw new Error(result.reason || 'Email send failed');
    }
    return { success: true, ...result };
  },

  // Backwards-compatible alias — also routes through dispatcher.
  async sendEmailViaProvider(to: string, subject: string, html: string, branchId: string) {
    return this.sendEmail(to, subject, html, branchId);
  },

  // SMS (opens SMS app with pre-filled message)
  async sendSMS(phone: string, message: string, options?: { branchId?: string; memberId?: string }) {
    const formattedPhone = phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    const url = `sms:${formattedPhone}?body=${encodedMessage}`;
    window.open(url, '_blank');
    // Log to communication_logs
    if (options?.branchId) {
      try {
        await this.logCommunication({
          branch_id: options.branchId,
          type: 'sms',
          recipient: phone,
          content: message.slice(0, 500),
          status: 'sent',
          member_id: options.memberId,
        });
      } catch (e) {
        console.error('Failed to log SMS communication:', e);
      }
    }
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
