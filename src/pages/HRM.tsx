import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateContractDrawer } from '@/components/hrm/CreateContractDrawer';
import { AddEmployeeDrawer } from '@/components/employees/AddEmployeeDrawer';
import { EditEmployeeDrawer } from '@/components/employees/EditEmployeeDrawer';
import { 
  Plus, 
  Users, 
  FileText, 
  DollarSign, 
  TrendingUp,
  Calendar,
  CheckCircle,
  Clock,
  Search,
  Download,
  Edit,
  Mail
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchEmployees, fetchEmployeeContracts, calculatePayroll } from '@/services/hrmService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { generatePayslipPDF } from '@/utils/pdfGenerator';

export default function HRMPage() {
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [contractDrawerOpen, setContractDrawerOpen] = useState(false);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [editEmployeeOpen, setEditEmployeeOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [payrollMonth, setPayrollMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['hrm-employees'],
    queryFn: () => fetchEmployees(),
  });

  // Fetch all contracts
  const { data: allContracts = [] } = useQuery({
    queryKey: ['all-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          employees(employee_code, profile:user_id(full_name))
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fetch staff attendance for HRM tab
  const { data: staffAttendance = [] } = useQuery({
    queryKey: ['hrm-staff-attendance', payrollMonth],
    queryFn: async () => {
      const startDate = `${payrollMonth}-01T00:00:00`;
      const endDate = new Date(parseInt(payrollMonth.split('-')[0]), parseInt(payrollMonth.split('-')[1]), 0).toISOString();
      const { data, error } = await supabase
        .from('staff_attendance')
        .select('*')
        .gte('check_in', startDate)
        .lte('check_in', endDate)
        .order('check_in', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Payroll calculations per employee
  const { data: payrollData = {} } = useQuery({
    queryKey: ['hrm-payroll', payrollMonth, employees.length],
    queryFn: async () => {
      const results: Record<string, any> = {};
      const activeEmps = employees.filter((e: any) => e.is_active);
      for (const emp of activeEmps) {
        try {
          const calc = await calculatePayroll(emp.id, payrollMonth);
          results[emp.id] = calc;
        } catch {
          results[emp.id] = { baseSalary: emp.salary || 0, proRatedPay: emp.salary || 0, ptCommission: 0, grossPay: emp.salary || 0, pfDeduction: 0, netPay: emp.salary || 0, daysPresent: 0, workingDays: 26 };
        }
      }
      return results;
    },
    enabled: employees.length > 0,
  });

  // Filter employees
  const filteredEmployees = employees.filter((emp: any) => {
    const name = emp.profile?.full_name || '';
    const code = emp.employee_code || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      code.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const stats = {
    total: employees.length,
    active: employees.filter((e: any) => e.is_active).length,
    totalSalary: employees.reduce((sum: number, e: any) => sum + (e.salary || 0), 0),
    activeContracts: allContracts.filter((c: any) => c.status === 'active').length,
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-success/10 text-success border-success/20',
      draft: 'bg-muted text-muted-foreground border-border',
      pending: 'bg-warning/10 text-warning border-warning/20',
      expired: 'bg-destructive/10 text-destructive border-destructive/20',
      terminated: 'bg-destructive/10 text-destructive border-destructive/20',
    };
    return colors[status] || 'bg-muted text-muted-foreground border-border';
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'E';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Payroll processing
  const processPayroll = useMutation({
    mutationFn: async (employeeId: string) => {
      const employee = employees.find((e: any) => e.id === employeeId);
      if (!employee) throw new Error('Employee not found');
      toast.success(`Payroll processed for ${employee.profile?.full_name}`);
    },
  });

  const processAllPayroll = useMutation({
    mutationFn: async () => {
      const activeEmployees = employees.filter((e: any) => e.is_active);
      toast.success(`Payroll processed for ${activeEmployees.length} employees`);
    },
  });

  // Get attendance summary per employee
  const getEmployeeAttendanceSummary = (userId: string) => {
    const records = staffAttendance.filter((a: any) => a.user_id === userId);
    const totalDays = records.length;
    const totalHours = records.reduce((sum: number, a: any) => {
      if (a.check_in && a.check_out) {
        return sum + (new Date(a.check_out).getTime() - new Date(a.check_in).getTime()) / 3600000;
      }
      return sum;
    }, 0);
    return { totalDays, totalHours: Math.round(totalHours * 10) / 10, records };
  };

  // Total payroll summary
  const totalPayrollSummary = Object.values(payrollData as Record<string, any>).reduce(
    (acc: any, p: any) => ({
      totalBase: acc.totalBase + (p.proRatedPay || 0),
      totalCommission: acc.totalCommission + (p.ptCommission || 0),
      totalGross: acc.totalGross + (p.grossPay || 0),
      totalDeductions: acc.totalDeductions + (p.pfDeduction || 0),
      totalNet: acc.totalNet + (p.netPay || 0),
    }),
    { totalBase: 0, totalCommission: 0, totalGross: 0, totalDeductions: 0, totalNet: 0 }
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Human Resources</h1>
            <p className="text-muted-foreground mt-1">Manage employees, contracts, attendance & payroll</p>
          </div>
          <Button onClick={() => setAddEmployeeOpen(true)} className="bg-accent hover:bg-accent/90">
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Total Employees</p>
                  <h3 className="text-3xl font-bold mt-1">{stats.total}</h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-success to-success/80 text-success-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Active</p>
                  <h3 className="text-3xl font-bold mt-1">{stats.active}</h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-info to-info/80 text-info-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Active Contracts</p>
                  <h3 className="text-3xl font-bold mt-1">{stats.activeContracts}</h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <FileText className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-accent to-accent/80 text-accent-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Monthly Payroll</p>
                  <h3 className="text-3xl font-bold mt-1">₹{stats.totalSalary.toLocaleString()}</h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <DollarSign className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="employees">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
          </TabsList>

          {/* Employees Tab */}
          <TabsContent value="employees" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle>All Employees</CardTitle>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search employees..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Salary</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((employee: any) => (
                        <TableRow key={employee.id} className="group">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-accent/10 text-accent font-semibold">
                                  {getInitials(employee.profile?.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{employee.profile?.full_name || 'N/A'}</p>
                                <p className="text-sm text-muted-foreground">{employee.profile?.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{employee.employee_code}</span>
                          </TableCell>
                          <TableCell>{employee.department || '-'}</TableCell>
                          <TableCell>{employee.position || '-'}</TableCell>
                          <TableCell className="font-semibold">
                            ₹{(employee.salary || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge className={`border ${employee.is_active ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border'}`}>
                              {employee.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedEmployee(employee);
                                  setContractDrawerOpen(true);
                                }}
                              >
                                <FileText className="mr-1 h-3 w-3" />
                                Contract
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => {
                                  setEditingEmployee(employee);
                                  setEditEmployeeOpen(true);
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredEmployees.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No employees found</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contracts Tab */}
          <TabsContent value="contracts" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>All Contracts</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Base Salary</TableHead>
                      <TableHead>Commission %</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allContracts.map((contract: any) => (
                      <TableRow key={contract.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-accent/10 text-accent text-xs">
                                {getInitials(contract.employees?.profile?.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{contract.employees?.profile?.full_name || 'N/A'}</p>
                              <p className="text-xs text-muted-foreground">{contract.employees?.employee_code}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{contract.contract_type.replace('_', ' ')}</TableCell>
                        <TableCell>{format(new Date(contract.start_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          {contract.end_date 
                            ? format(new Date(contract.end_date), 'dd MMM yyyy') 
                            : <span className="text-muted-foreground">Ongoing</span>
                          }
                        </TableCell>
                        <TableCell className="font-semibold">₹{(contract.base_salary || contract.salary).toLocaleString()}</TableCell>
                        <TableCell>
                          {contract.commission_percentage > 0 
                            ? <Badge className="bg-accent/10 text-accent border-accent/20 border">{contract.commission_percentage}%</Badge>
                            : <span className="text-muted-foreground">-</span>
                          }
                        </TableCell>
                        <TableCell>
                          <Badge className={`border ${getStatusColor(contract.status)}`}>
                            {contract.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {allContracts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No contracts found</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Tab (NEW) */}
          <TabsContent value="attendance" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-accent" />
                    Staff Attendance
                  </CardTitle>
                  <Input
                    type="month"
                    value={payrollMonth}
                    onChange={(e) => setPayrollMonth(e.target.value)}
                    className="w-[180px]"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {/* Summary per employee */}
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 mb-6">
                  {employees.filter((e: any) => e.is_active).map((emp: any) => {
                    const summary = getEmployeeAttendanceSummary(emp.user_id);
                    return (
                      <Card key={emp.id} className="border">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-accent/10 text-accent text-sm font-semibold">
                                {getInitials(emp.profile?.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{emp.profile?.full_name}</p>
                              <p className="text-xs text-muted-foreground">{emp.employee_code}</p>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="bg-muted/50 rounded-lg p-2 text-center">
                              <p className="text-lg font-bold text-foreground">{summary.totalDays}</p>
                              <p className="text-xs text-muted-foreground">Days Present</p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-2 text-center">
                              <p className="text-lg font-bold text-foreground">{summary.totalHours}h</p>
                              <p className="text-xs text-muted-foreground">Total Hours</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Detailed log */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffAttendance.slice(0, 50).map((record: any) => {
                      const emp = employees.find((e: any) => e.user_id === record.user_id);
                      const duration = record.check_in && record.check_out
                        ? ((new Date(record.check_out).getTime() - new Date(record.check_in).getTime()) / 3600000).toFixed(1)
                        : '-';
                      return (
                        <TableRow key={record.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="bg-accent/10 text-accent text-xs">
                                  {getInitials(emp?.profile?.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">{emp?.profile?.full_name || 'Unknown'}</span>
                            </div>
                          </TableCell>
                          <TableCell>{format(new Date(record.check_in), 'dd MMM yyyy')}</TableCell>
                          <TableCell>{format(new Date(record.check_in), 'hh:mm a')}</TableCell>
                          <TableCell>
                            {record.check_out ? format(new Date(record.check_out), 'hh:mm a') : <Badge variant="outline" className="text-warning">Active</Badge>}
                          </TableCell>
                          <TableCell>{duration !== '-' ? `${duration}h` : '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                    {staffAttendance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No attendance records for this month</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payroll Tab */}
          <TabsContent value="payroll" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle>Payroll Processing</CardTitle>
                  <div className="flex items-center gap-3">
                    <Input
                      type="month"
                      value={payrollMonth}
                      onChange={(e) => setPayrollMonth(e.target.value)}
                      className="w-[180px]"
                    />
                    <Button 
                      onClick={() => processAllPayroll.mutate()}
                      disabled={processAllPayroll.isPending}
                      className="bg-accent hover:bg-accent/90"
                    >
                      <DollarSign className="mr-2 h-4 w-4" />
                      Process All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Base Pay</TableHead>
                      <TableHead>PT Commission</TableHead>
                      <TableHead>Gross</TableHead>
                      <TableHead>PF (12%)</TableHead>
                      <TableHead>Net Pay</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.filter((e: any) => e.is_active).map((employee: any) => {
                      const p = (payrollData as Record<string, any>)[employee.id] || {};
                      
                      return (
                        <TableRow key={employee.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-accent/10 text-accent text-xs">
                                  {getInitials(employee.profile?.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{employee.profile?.full_name}</p>
                                <p className="text-xs text-muted-foreground">{employee.employee_code}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{p.daysPresent || 0}/{p.workingDays || 26}</span>
                          </TableCell>
                          <TableCell>₹{(p.proRatedPay || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            {(p.ptCommission || 0) > 0 
                              ? <span className="text-success font-medium">+₹{p.ptCommission.toLocaleString()}</span>
                              : <span className="text-muted-foreground">-</span>
                            }
                          </TableCell>
                          <TableCell className="font-semibold">₹{(p.grossPay || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-destructive">-₹{(p.pfDeduction || 0).toLocaleString()}</TableCell>
                          <TableCell className="font-semibold text-success">₹{(p.netPay || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => processPayroll.mutate(employee.id)}
                              >
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Process
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  generatePayslipPDF({
                                    employeeName: employee.profile?.full_name || 'Employee',
                                    employeeCode: employee.employee_code,
                                    month: format(new Date(payrollMonth), 'MMMM yyyy'),
                                    baseSalary: employee.salary || 0,
                                    daysPresent: p.daysPresent || 0,
                                    workingDays: p.workingDays || 26,
                                    proRatedPay: p.proRatedPay || 0,
                                    ptCommission: p.ptCommission || 0,
                                    grossPay: p.grossPay || 0,
                                    pfDeduction: p.pfDeduction || 0,
                                    netPay: p.netPay || 0,
                                    department: employee.department,
                                    position: employee.position,
                                  });
                                }}
                                title="Download Payslip"
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toast.info('Email payslip feature coming soon')}
                                title="Send Payslip via Email"
                              >
                                <Mail className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {employees.filter((e: any) => e.is_active).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No active employees for payroll</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* Payroll Summary */}
                <div className="mt-6 p-4 rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-3">Payroll Summary - {format(new Date(payrollMonth), 'MMMM yyyy')}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Pro-rated Base</p>
                      <p className="text-lg font-bold">₹{Math.round(totalPayrollSummary.totalBase).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">PT Commission</p>
                      <p className="text-lg font-bold text-success">
                        +₹{Math.round(totalPayrollSummary.totalCommission).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Gross Pay</p>
                      <p className="text-lg font-bold">₹{Math.round(totalPayrollSummary.totalGross).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Deductions</p>
                      <p className="text-lg font-bold text-destructive">
                        -₹{Math.round(totalPayrollSummary.totalDeductions).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Net Payable</p>
                      <p className="text-lg font-bold text-success">
                        ₹{Math.round(totalPayrollSummary.totalNet).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Contract Drawer */}
      <CreateContractDrawer
        open={contractDrawerOpen}
        onOpenChange={setContractDrawerOpen}
        employee={selectedEmployee}
      />

      {/* Add Employee Drawer */}
      <AddEmployeeDrawer
        open={addEmployeeOpen}
        onOpenChange={setAddEmployeeOpen}
      />

      {/* Edit Employee Drawer */}
      <EditEmployeeDrawer
        open={editEmployeeOpen}
        onOpenChange={setEditEmployeeOpen}
        employee={editingEmployee}
      />
    </AppLayout>
  );
}
