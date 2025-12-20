import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type StaffAttendance = Database['public']['Tables']['staff_attendance']['Row'];

export interface StaffAttendanceWithDetails extends StaffAttendance {
  employee?: {
    id: string;
    employee_code: string;
    position: string | null;
    department: string | null;
  } | null;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export const staffAttendanceService = {
  // Check in staff by user_id
  async checkIn(userId: string, branchId: string, method: string = 'manual') {
    // First check if already checked in
    const { data: existing } = await supabase
      .from('staff_attendance')
      .select('id')
      .eq('user_id', userId)
      .is('check_out', null)
      .single();

    if (existing) {
      return { success: false, message: 'Already checked in', attendance_id: existing.id };
    }

    const { data, error } = await supabase
      .from('staff_attendance')
      .insert({
        user_id: userId,
        branch_id: branchId,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, attendance_id: data.id, message: 'Check-in successful' };
  },

  // Check out staff by user_id
  async checkOut(userId: string) {
    const { data: attendance, error: findError } = await supabase
      .from('staff_attendance')
      .select('*')
      .eq('user_id', userId)
      .is('check_out', null)
      .order('check_in', { ascending: false })
      .limit(1)
      .single();

    if (findError) {
      if (findError.code === 'PGRST116') {
        return { success: false, message: 'No active check-in found' };
      }
      throw findError;
    }

    const { error: updateError } = await supabase
      .from('staff_attendance')
      .update({ check_out: new Date().toISOString() })
      .eq('id', attendance.id);

    if (updateError) throw updateError;

    const duration = (new Date().getTime() - new Date(attendance.check_in).getTime()) / 60000;
    return {
      success: true,
      attendance_id: attendance.id,
      check_in: attendance.check_in,
      check_out: new Date().toISOString(),
      duration_minutes: Math.round(duration),
      message: 'Check-out successful',
    };
  },

  // Get today's staff attendance
  async getTodayAttendance(branchId: string) {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('staff_attendance')
      .select('*')
      .eq('branch_id', branchId)
      .gte('check_in', `${today}T00:00:00`)
      .order('check_in', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get currently checked-in staff
  async getCheckedInStaff(branchId: string) {
    const { data, error } = await supabase
      .from('staff_attendance')
      .select('*')
      .eq('branch_id', branchId)
      .is('check_out', null)
      .order('check_in', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get user attendance history
  async getUserAttendance(userId: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('staff_attendance')
      .select('*')
      .eq('user_id', userId)
      .order('check_in', { ascending: false });

    if (startDate) {
      query = query.gte('check_in', `${startDate}T00:00:00`);
    }
    if (endDate) {
      query = query.lte('check_in', `${endDate}T23:59:59`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Get all employees for a branch
  async getBranchEmployees(branchId: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('employee_code');

    if (error) throw error;
    return data;
  },
};
