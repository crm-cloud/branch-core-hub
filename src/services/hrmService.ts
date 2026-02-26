import { supabase } from '@/integrations/supabase/client';

export interface Employee {
  id: string;
  user_id: string;
  branch_id: string;
  employee_code: string;
  department: string | null;
  position: string | null;
  hire_date: string;
  salary: number | null;
  salary_type: string | null;
  bank_name: string | null;
  bank_account: string | null;
  tax_id: string | null;
  is_active: boolean | null;
  created_at: string;
}

export interface Contract {
  id: string;
  employee_id: string;
  trainer_id?: string;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  salary: number;
  base_salary: number;
  commission_percentage: number;
  terms: any;
  document_url: string | null;
  status: 'draft' | 'pending' | 'active' | 'expired' | 'terminated';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export async function fetchEmployees(branchId?: string) {
  let query = supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false });

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const userIds = data?.map(e => e.user_id).filter(Boolean) || [];
  let profiles: any[] = [];
  
  if (userIds.length > 0) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, avatar_url, date_of_birth')
      .in('id', userIds);
    profiles = profileData || [];
  }

  return data?.map(emp => ({
    ...emp,
    profile: profiles.find(p => p.id === emp.user_id) || null
  })) || [];
}

export async function getEmployee(id: string) {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;

  let profile = null;
  if (data?.user_id) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, avatar_url, date_of_birth, address, city, state')
      .eq('id', data.user_id)
      .maybeSingle();
    profile = profileData;
  }

  return { ...data, profile };
}

export async function createEmployee(employee: {
  userId: string;
  branchId: string;
  department?: string;
  position?: string;
  hireDate: string;
  salary?: number;
  salaryType?: string;
}) {
  const { count } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })
    .eq('branch_id', employee.branchId);

  const employeeCode = `EMP-${String((count || 0) + 1).padStart(4, '0')}`;

  const { data, error } = await supabase
    .from('employees')
    .insert({
      user_id: employee.userId,
      branch_id: employee.branchId,
      employee_code: employeeCode,
      department: employee.department,
      position: employee.position,
      hire_date: employee.hireDate,
      salary: employee.salary,
      salary_type: employee.salaryType,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEmployee(id: string, updates: Partial<Employee>) {
  const { data, error } = await supabase
    .from('employees')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchEmployeeContracts(employeeId: string) {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('employee_id', employeeId)
    .order('start_date', { ascending: false });

  if (error) throw error;
  return data as Contract[];
}

export async function createContract(contract: {
  employeeId?: string;
  trainerId?: string;
  contractType: string;
  startDate: string;
  endDate?: string;
  salary: number;
  baseSalary?: number;
  commissionPercentage?: number;
  terms?: any;
  documentUrl?: string;
}) {
  const { data, error } = await supabase
    .from('contracts')
    .insert({
      employee_id: contract.employeeId || null,
      trainer_id: contract.trainerId || null,
      contract_type: contract.contractType,
      start_date: contract.startDate,
      end_date: contract.endDate,
      salary: contract.salary,
      base_salary: contract.baseSalary || contract.salary,
      commission_percentage: contract.commissionPercentage || 0,
      terms: contract.terms,
      document_url: contract.documentUrl || null,
      status: 'draft',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function approveContract(contractId: string, approvedBy: string) {
  const { data, error } = await supabase
    .from('contracts')
    .update({
      status: 'active',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq('id', contractId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchEmployeeAttendance(employeeId: string, startDate?: string, endDate?: string) {
  const { data: employee } = await supabase
    .from('employees')
    .select('user_id')
    .eq('id', employeeId)
    .single();

  if (!employee) throw new Error('Employee not found');

  let query = supabase
    .from('staff_attendance')
    .select('*')
    .eq('user_id', employee.user_id)
    .order('check_in', { ascending: false });

  if (startDate) query = query.gte('check_in', startDate);
  if (endDate) query = query.lte('check_in', endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function calculatePayroll(employeeId: string, month: string) {
  const employee = await getEmployee(employeeId);
  if (!employee) throw new Error('Employee not found');

  const startDate = `${month}-01`;
  const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0];

  const attendance = await fetchEmployeeAttendance(employeeId, startDate, endDate);
  
  const workingDays = 26; // Standard Indian working days
  const daysPresent = attendance.length;
  const baseSalary = employee.salary || 0;
  const proRatedPay = Math.round((baseSalary / workingDays) * daysPresent);

  // Fetch PT commissions if employee has a linked trainer record
  let ptCommission = 0;
  const { data: trainerLink } = await supabase
    .from('trainers')
    .select('id, pt_share_percentage')
    .eq('user_id', employee.user_id)
    .maybeSingle();
  
  if (trainerLink) {
    const { data: commissions } = await supabase
      .from('trainer_commissions')
      .select('amount')
      .eq('trainer_id', trainerLink.id)
      .gte('created_at', startDate)
      .lte('created_at', endDate);
    ptCommission = commissions?.reduce((s, c) => s + (c.amount || 0), 0) || 0;
  }

  const grossPay = proRatedPay + ptCommission;
  const pfDeduction = Math.round(proRatedPay * 0.12);
  const netPay = grossPay - pfDeduction;

  return {
    employee,
    month,
    baseSalary,
    daysPresent,
    workingDays,
    proRatedPay,
    ptCommission,
    grossPay,
    pfDeduction,
    netPay,
  };
}
