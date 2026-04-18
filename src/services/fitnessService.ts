import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { WorkoutPlanContent, DietPlanContent } from "@/types/fitnessPlan";

export type FitnessPlanContent = WorkoutPlanContent | DietPlanContent;

/**
 * Convert a typed plan-content object to Supabase's recursive `Json` shape.
 * Uses a JSON round-trip so the value is provably JSON-serialisable at runtime
 * — avoids structural-type escape hatches like `as unknown as Json`.
 */
function toJsonContent(content: FitnessPlanContent): Json {
  return JSON.parse(JSON.stringify(content)) as Json;
}

/** Narrow Supabase `Json` plan content back to a typed plan content shape. */
function narrowPlanContent(json: Json): FitnessPlanContent {
  // Plan content is always a JSON object; trust the column shape, but avoid `any`.
  return json as unknown as FitnessPlanContent;
}

export interface FitnessPlanTemplate {
  id: string;
  branch_id: string | null;
  name: string;
  type: 'workout' | 'diet';
  description: string | null;
  difficulty: string | null;
  goal: string | null;
  content: FitnessPlanContent;
  is_public: boolean | null;
  is_active: boolean | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberFitnessPlan {
  id: string;
  member_id: string;
  plan_type: string;
  plan_name: string;
  description: string | null;
  plan_data: Json;
  is_custom: boolean | null;
  is_public: boolean | null;
  valid_from: string | null;
  valid_until: string | null;
  created_by: string | null;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch plan templates
export async function fetchPlanTemplates(branchId?: string, type?: 'workout' | 'diet'): Promise<FitnessPlanTemplate[]> {
  let query = supabase
    .from('fitness_plan_templates')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (branchId) {
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
  }
  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(row => ({
    ...row,
    type: row.type as 'workout' | 'diet',
    content: narrowPlanContent(row.content),
  }));
}

// Create plan template
export async function createPlanTemplate(template: {
  branch_id?: string | null;
  name: string;
  type: 'workout' | 'diet';
  description?: string;
  difficulty?: string;
  goal?: string;
  content: FitnessPlanContent;
  is_public?: boolean;
}): Promise<FitnessPlanTemplate> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('fitness_plan_templates')
    .insert({
      ...template,
      content: toJsonContent(template.content),
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    ...data,
    type: data.type as 'workout' | 'diet',
    content: narrowPlanContent(data.content),
  };
}

// Assign plan to member
export async function assignPlanToMember(params: {
  member_id: string;
  plan_name: string;
  plan_type: 'workout' | 'diet';
  description?: string;
  plan_data: FitnessPlanContent;
  is_custom?: boolean;
  valid_from?: string;
  valid_until?: string;
  branch_id?: string;
}): Promise<MemberFitnessPlan> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('member_fitness_plans')
    .insert({
      member_id: params.member_id,
      plan_name: params.plan_name,
      plan_type: params.plan_type,
      description: params.description,
      plan_data: toJsonContent(params.plan_data),
      is_custom: params.is_custom ?? true,
      is_public: false,
      valid_from: params.valid_from || new Date().toISOString().split('T')[0],
      valid_until: params.valid_until,
      branch_id: params.branch_id,
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Fetch member's assigned plans
export async function fetchMemberPlans(memberId: string): Promise<MemberFitnessPlan[]> {
  const { data, error } = await supabase
    .from('member_fitness_plans')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export type NotificationChannel = 'email' | 'whatsapp' | 'in_app';

export interface BulkAssignResult {
  member_id: string;
  member_name: string;
  plan_id?: string;
  success: boolean;
  error?: string;
  channels: Partial<Record<NotificationChannel, { sent: boolean; error?: string }>>;
}

export interface BulkAssignParams {
  member_ids: string[];
  plan_name: string;
  plan_type: 'workout' | 'diet';
  description?: string;
  plan_data: FitnessPlanContent;
  is_custom?: boolean;
  valid_from?: string;
  valid_until?: string;
  branch_id?: string;
  channels?: NotificationChannel[];
}

interface MemberContact {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  user_id: string | null;
}

async function loadMemberContacts(memberIds: string[]): Promise<Map<string, MemberContact>> {
  if (memberIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('members')
    .select('id, user_id, profiles:user_id(full_name, email, phone)')
    .in('id', memberIds);
  if (error) throw error;
  const map = new Map<string, MemberContact>();
  for (const row of data || []) {
    const p: any = (row as any).profiles;
    map.set((row as any).id, {
      id: (row as any).id,
      user_id: (row as any).user_id,
      full_name: p?.full_name || 'Member',
      email: p?.email || null,
      phone: p?.phone || null,
    });
  }
  return map;
}

async function sendOneNotification(
  channel: NotificationChannel,
  contact: MemberContact,
  params: { plan_name: string; plan_type: 'workout' | 'diet'; branch_id?: string },
): Promise<{ sent: boolean; error?: string }> {
  const subject = `New ${params.plan_type} plan assigned`;
  const body = `Hi ${contact.full_name}, your trainer has assigned a new ${params.plan_type} plan: "${params.plan_name}". Open the gym app to view it.`;
  try {
    if (channel === 'email') {
      if (!contact.email) return { sent: false, error: 'No email on file' };
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: contact.email,
          subject,
          html: `<p>${body}</p>`,
          branch_id: params.branch_id,
        },
      });
      if (error) throw error;
      return { sent: true };
    }
    if (channel === 'whatsapp') {
      if (!contact.phone) return { sent: false, error: 'No phone on file' };
      if (!params.branch_id) return { sent: false, error: 'No branch context' };
      // Insert pending message row to obtain message_id (mirrors WhatsAppChat flow).
      const { data: msg, error: insertErr } = await supabase
        .from('whatsapp_messages')
        .insert({
          branch_id: params.branch_id,
          phone_number: contact.phone,
          content: body,
          message_type: 'text',
          direction: 'outbound',
          status: 'pending',
          member_id: contact.id,
        } as any)
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      const { error: sendErr } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          message_id: (msg as any).id,
          phone_number: contact.phone,
          content: body,
          branch_id: params.branch_id,
        },
      });
      if (sendErr) throw sendErr;
      return { sent: true };
    }
    if (channel === 'in_app') {
      if (!contact.user_id) return { sent: false, error: 'Member has no app account' };
      const { error } = await supabase.from('notifications').insert({
        user_id: contact.user_id,
        branch_id: params.branch_id || null,
        title: subject,
        message: body,
        type: 'info',
        category: 'fitness_plan',
        action_url: params.plan_type === 'workout' ? '/my-workout' : '/my-diet',
      });
      if (error) throw error;
      return { sent: true };
    }
    return { sent: false, error: 'Unknown channel' };
  } catch (err: any) {
    return { sent: false, error: err?.message || String(err) };
  }
}

/**
 * Bulk-assign a plan to multiple members and fire notifications on the
 * requested channels. Returns a per-member, per-channel result so the UI can
 * render a confirmation screen.
 */
export async function assignPlanToMembers(params: BulkAssignParams): Promise<BulkAssignResult[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const channels = params.channels ?? [];
  const contacts = await loadMemberContacts(params.member_ids);

  const rows = params.member_ids.map((member_id) => ({
    member_id,
    plan_name: params.plan_name,
    plan_type: params.plan_type,
    description: params.description,
    plan_data: toJsonContent(params.plan_data),
    is_custom: params.is_custom ?? true,
    is_public: false,
    valid_from: params.valid_from || new Date().toISOString().split('T')[0],
    valid_until: params.valid_until,
    branch_id: params.branch_id,
    created_by: user?.id,
  }));

  const { data: inserted, error } = await supabase
    .from('member_fitness_plans')
    .insert(rows)
    .select('id, member_id');
  if (error) throw error;

  const planIdByMember = new Map<string, string>();
  for (const row of inserted || []) planIdByMember.set((row as any).member_id, (row as any).id);

  const results: BulkAssignResult[] = [];
  for (const member_id of params.member_ids) {
    const contact = contacts.get(member_id);
    const channelResults: BulkAssignResult['channels'] = {};
    for (const ch of channels) {
      channelResults[ch] = contact
        ? await sendOneNotification(ch, contact, {
            plan_name: params.plan_name,
            plan_type: params.plan_type,
            branch_id: params.branch_id,
          })
        : { sent: false, error: 'Member contact not found' };
    }
    results.push({
      member_id,
      member_name: contact?.full_name || 'Unknown',
      plan_id: planIdByMember.get(member_id),
      success: planIdByMember.has(member_id),
      channels: channelResults,
    });
  }
  return results;
}

// Search members for plan assignment
export async function searchMembersForAssignment(searchTerm: string, branchId?: string | null): Promise<{
  id: string;
  member_code: string;
  full_name: string;
}[]> {
  const { data, error } = await supabase.rpc('search_members', {
    search_term: searchTerm,
    p_branch_id: branchId || null,
    p_limit: 10,
  });

  if (error) {
    console.error('Search error:', error);
    return [];
  }

  return (data || []).filter((m: any) => m.member_status === 'active').map((m: any) => ({
    id: m.id,
    member_code: m.member_code,
    full_name: m.full_name,
  }));
}
