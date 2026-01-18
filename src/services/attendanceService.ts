import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';

type MemberAttendance = Database['public']['Tables']['member_attendance']['Row'];

export interface CheckInResult {
  valid: boolean;
  success?: boolean;
  attendance_id?: string;
  message: string;
  reason?: string;
  plan_name?: string;
  days_remaining?: number;
  check_in_time?: string;
}

export interface CheckOutResult {
  success: boolean;
  attendance_id?: string;
  message: string;
  check_in?: string;
  check_out?: string;
  duration_minutes?: number;
}

export interface MemberAttendanceWithDetails extends MemberAttendance {
  members?: {
    member_code: string;
    profiles?: {
      full_name: string | null;
      avatar_url: string | null;
    } | null;
  } | null;
}

export const attendanceService = {
  // Validate member can check in
  async validateCheckIn(memberId: string, branchId: string): Promise<CheckInResult> {
    const { data, error } = await supabase.rpc('validate_member_checkin', {
      _member_id: memberId,
      _branch_id: branchId,
    });

    if (error) throw error;
    return data as unknown as CheckInResult;
  },

  // Perform check-in
  async checkIn(memberId: string, branchId: string, method: string = 'manual'): Promise<CheckInResult> {
    const { data, error } = await supabase.rpc('member_check_in', {
      _member_id: memberId,
      _branch_id: branchId,
      _method: method,
    });

    if (error) throw error;
    return data as unknown as CheckInResult;
  },

  // Perform check-out
  async checkOut(memberId: string): Promise<CheckOutResult> {
    const { data, error } = await supabase.rpc('member_check_out', {
      _member_id: memberId,
    });

    if (error) throw error;
    return data as unknown as CheckOutResult;
  },

  // Get today's attendance for a branch
  async getTodayAttendance(branchId: string): Promise<MemberAttendanceWithDetails[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('member_attendance')
      .select(`
        *,
        members (
          member_code,
          user_id
        )
      `)
      .eq('branch_id', branchId)
      .gte('check_in', `${today}T00:00:00`)
      .order('check_in', { ascending: false });

    if (error) throw error;
    return data as MemberAttendanceWithDetails[];
  },

  // Get attendance history for a member
  async getMemberAttendance(memberId: string, limit: number = 30) {
    const { data, error } = await supabase
      .from('member_attendance')
      .select('*')
      .eq('member_id', memberId)
      .order('check_in', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  // Get currently checked-in members
  async getCheckedInMembers(branchId: string) {
    const { data, error } = await supabase
      .from('member_attendance')
      .select(`
        *,
        members (
          member_code,
          user_id
        )
      `)
      .eq('branch_id', branchId)
      .is('check_out', null)
      .order('check_in', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Search member by code, name, phone or email for check-in using search_members RPC
  async searchMemberForCheckIn(query: string, branchId: string) {
    const { data, error } = await supabase.rpc('search_members', {
      search_term: query,
      p_branch_id: branchId,
    });

    if (error) {
      console.error('Search members error:', error);
      throw error;
    }
    
    // Map result to expected format
    return (data || []).map((m: any) => ({
      id: m.id,
      member_code: m.member_code,
      user_id: m.user_id,
      profiles: {
        full_name: m.full_name,
        avatar_url: m.avatar_url,
        phone: m.phone,
      },
    }));
  },
};
