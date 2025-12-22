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
  Download
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchEmployees, fetchEmployeeContracts } from '@/services/hrmService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function HRMPage() {
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [contractDrawerOpen, setContractDrawerOpen] = useState(false);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
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
      
      // In a real app, this would create payroll records
      toast.success(`Payroll processed for ${employee.profile?.full_name}`);
    },
  });

  const processAllPayroll = useMutation({
    mutationFn: async () => {
      const activeEmployees = employees.filter((e: any) => e.is_active);
      // In a real app, this would batch process all payrolls
      toast.success(`Payroll processed for ${activeEmployees.length} employees`);
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Human Resources</h1>
            <p className="text-muted-foreground mt-1">Manage employees, contracts, and payroll</p>
          </div>
          <Button onClick={() => setAddEmployeeOpen(true)} className="bg-accent hover:bg-accent/90">
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        </div>

        {/* Stats Cards - Vuexy Style */}
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
                      <TableHead>Salary</TableHead>
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
                        <TableCell className="font-semibold">₹{contract.salary.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={`border ${getStatusColor(contract.status)}`}>
                            {contract.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {allContracts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
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
                      <TableHead>Department</TableHead>
                      <TableHead>Base Salary</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Pay</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.filter((e: any) => e.is_active).map((employee: any) => {
                      const baseSalary = employee.salary || 0;
                      const deductions = Math.round(baseSalary * 0.1); // 10% deductions
                      const netPay = baseSalary - deductions;
                      
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
                          <TableCell>{employee.department || '-'}</TableCell>
                          <TableCell>₹{baseSalary.toLocaleString()}</TableCell>
                          <TableCell className="text-destructive">-₹{deductions.toLocaleString()}</TableCell>
                          <TableCell className="font-semibold text-success">₹{netPay.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className="bg-warning/10 text-warning border-warning/20 border">
                              Pending
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => processPayroll.mutate(employee.id)}
                            >
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Process
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {employees.filter((e: any) => e.is_active).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Base Salary</p>
                      <p className="text-lg font-bold">₹{stats.totalSalary.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Deductions</p>
                      <p className="text-lg font-bold text-destructive">
                        -₹{Math.round(stats.totalSalary * 0.1).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Net Payable</p>
                      <p className="text-lg font-bold text-success">
                        ₹{Math.round(stats.totalSalary * 0.9).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Employees</p>
                      <p className="text-lg font-bold">{stats.active}</p>
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
    </AppLayout>
  );
}
