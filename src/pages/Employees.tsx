import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Users, UserMinus, UserCheck, FileText, Filter } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AddEmployeeDrawer } from '@/components/employees/AddEmployeeDrawer';
import { CreateContractDrawer } from '@/components/hrm/CreateContractDrawer';
import { toast } from 'sonner';

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: employees = [], isLoading, error } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      console.log('Fetching employees...');
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          branches:branch_id(name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Employees query error:', error);
        throw error;
      }
      
      console.log('Employees fetched:', data?.length);
      
      // Fetch profiles separately
      if (data && data.length > 0) {
        const userIds = data.map((e: any) => e.user_id).filter(Boolean);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, avatar_url')
          .in('id', userIds);
        
        if (profilesError) {
          console.error('Profiles query error:', profilesError);
        }
        
        // Merge profiles into employees
        const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
        return data.map((emp: any) => ({
          ...emp,
          profiles: profileMap.get(emp.user_id) || null,
        }));
      }
      
      return data;
    },
  });

  const toggleActive = async (employeeId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ is_active: !currentStatus })
        .eq('id', employeeId);
      
      if (error) throw error;
      toast.success(currentStatus ? 'Employee deactivated' : 'Employee activated');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    } catch (error) {
      toast.error('Failed to update employee status');
    }
  };

  const openContractDrawer = (employee: any) => {
    setSelectedEmployee(employee);
    setContractOpen(true);
  };

  // Get unique departments for filter
  const departments = [...new Set(employees.map((e: any) => e.department).filter(Boolean))];

  // Filter employees
  const filteredEmployees = employees.filter((employee: any) => {
    const matchesSearch = search === '' || 
      employee.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      employee.employee_code?.toLowerCase().includes(search.toLowerCase()) ||
      employee.profiles?.email?.toLowerCase().includes(search.toLowerCase()) ||
      employee.profiles?.phone?.includes(search);
    
    const matchesDepartment = departmentFilter === 'all' || employee.department === departmentFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && employee.is_active) ||
      (statusFilter === 'inactive' && !employee.is_active);
    
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Employees</h1>
            <p className="text-muted-foreground">Manage your staff and employee records</p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Employees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{employees.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">
                {employees.filter((e: any) => e.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Departments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{departments.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-muted to-muted/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Inactive</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-muted-foreground">
                {employees.filter((e: any) => !e.is_active).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, code, email, or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept as string}>
                      {dept as string}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Employees Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Employees ({filteredEmployees.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hire Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee: any) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={employee.profiles?.avatar_url} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {employee.profiles?.full_name?.[0] || 'E'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{employee.profiles?.full_name || 'N/A'}</div>
                            <div className="text-sm text-muted-foreground">{employee.profiles?.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{employee.employee_code}</TableCell>
                      <TableCell>{employee.department || '-'}</TableCell>
                      <TableCell>{employee.position || '-'}</TableCell>
                      <TableCell>{(employee.branches as any)?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge className={employee.is_active ? 'bg-success/10 text-success border-success/30' : 'bg-muted text-muted-foreground'}>
                          {employee.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(employee.hire_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openContractDrawer(employee)}
                            title="Create Contract"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActive(employee.id, employee.is_active)}
                            title={employee.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {employee.is_active ? (
                              <UserMinus className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {search || departmentFilter !== 'all' || statusFilter !== 'all'
                          ? 'No employees match your filters'
                          : 'No employees found'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <AddEmployeeDrawer open={addOpen} onOpenChange={setAddOpen} />
        <CreateContractDrawer 
          open={contractOpen} 
          onOpenChange={setContractOpen} 
          employee={selectedEmployee}
        />
      </div>
    </AppLayout>
  );
}
