import { supabase } from "@/integrations/supabase/client";

export interface FitnessPlanTemplate {
  id: string;
  branch_id: string | null;
  name: string;
  type: 'workout' | 'diet';
  description: string | null;
  difficulty: string | null;
  goal: string | null;
  content: any;
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
  plan_data: any;
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
  return (data || []) as FitnessPlanTemplate[];
}

// Create plan template
export async function createPlanTemplate(template: {
  branch_id?: string | null;
  name: string;
  type: 'workout' | 'diet';
  description?: string;
  difficulty?: string;
  goal?: string;
  content: any;
  is_public?: boolean;
}): Promise<FitnessPlanTemplate> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('fitness_plan_templates')
    .insert({
      ...template,
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as FitnessPlanTemplate;
}

// Assign plan to member
export async function assignPlanToMember(params: {
  member_id: string;
  plan_name: string;
  plan_type: 'workout' | 'diet';
  description?: string;
  plan_data: any;
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
      plan_data: params.plan_data,
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
  return data as MemberFitnessPlan;
}

// Fetch member's assigned plans
export async function fetchMemberPlans(memberId: string): Promise<MemberFitnessPlan[]> {
  const { data, error } = await supabase
    .from('member_fitness_plans')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as MemberFitnessPlan[];
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

  return (data || []).filter((m: any) => m.is_active).map((m: any) => ({
    id: m.id,
    member_code: m.member_code,
    full_name: m.full_name,
  }));
}
