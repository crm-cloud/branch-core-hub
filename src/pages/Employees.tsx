import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Users, UserMinus, UserCheck, FileText, Filter, Dumbbell } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AddEmployeeDrawer } from '@/components/employees/AddEmployeeDrawer';
import { CreateContractDrawer } from '@/components/hrm/CreateContractDrawer';
import { toast } from 'sonner';

type StaffType = 'all' | 'employee' | 'trainer';

interface UnifiedStaff {
  id: string;
  user_id: string | null;
  staff_type: 'employee' | 'trainer';
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  code: string | null;
  department: string | null;
  position: string | null;
  branch_name: string | null;
  is_active: boolean;
  hire_date: string;
  specialization?: string | null;
}

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [staffTypeFilter, setStaffTypeFilter] = useState<StaffType>('all');

  // Fetch both employees and trainers
  const { data: allStaff = [], isLoading } = useQuery({
    queryKey: ['all-staff'],
    queryFn: async () => {
      // Fetch employees
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select(`*, branches:branch_id(name)`)
        .order('created_at', { ascending: false });
      
      if (empError) throw empError;

      // Fetch trainers
      const { data: trainers, error: trainerError } = await supabase
        .from('trainers')
        .select(`*, branches:branch_id(name)`)
        .order('created_at', { ascending: false });
      
      if (trainerError) throw trainerError;

      // Fetch profiles for all users
      const allUserIds = [
        ...(employees || []).map(e => e.user_id),
        ...(trainers || []).map(t => t.user_id),
      ].filter(Boolean);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, avatar_url')
        .in('id', allUserIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Transform employees
      const employeeStaff: UnifiedStaff[] = (employees || []).map(emp => ({
        id: emp.id,
        user_id: emp.user_id,
        staff_type: 'employee' as const,
        name: profileMap.get(emp.user_id)?.full_name || 'Unknown',
        email: profileMap.get(emp.user_id)?.email || null,
        phone: profileMap.get(emp.user_id)?.phone || null,
        avatar_url: profileMap.get(emp.user_id)?.avatar_url || null,
        code: emp.employee_code,
        department: emp.department,
        position: emp.position,
        branch_name: (emp.branches as any)?.name || null,
        is_active: emp.is_active,
        hire_date: emp.hire_date,
      }));

      // Transform trainers
      const trainerStaff: UnifiedStaff[] = (trainers || []).map(trainer => ({
        id: trainer.id,
        user_id: trainer.user_id,
        staff_type: 'trainer' as const,
        name: profileMap.get(trainer.user_id)?.full_name || 'Unknown',
        email: profileMap.get(trainer.user_id)?.email || null,
        phone: profileMap.get(trainer.user_id)?.phone || null,
        avatar_url: profileMap.get(trainer.user_id)?.avatar_url || null,
        code: null,
        department: 'Training',
        position: 'Trainer',
        branch_name: (trainer.branches as any)?.name || null,
        is_active: trainer.is_active,
        hire_date: trainer.created_at,
        specialization: trainer.specializations?.join(', ') || null,
      }));

      return [...employeeStaff, ...trainerStaff];
    },
  });

  const toggleActive = async (staff: UnifiedStaff) => {
    try {
      const table = staff.staff_type === 'trainer' ? 'trainers' : 'employees';
      const { error } = await supabase
        .from(table)
        .update({ is_active: !staff.is_active })
        .eq('id', staff.id);
      
      if (error) throw error;
      toast.success(staff.is_active ? 'Staff deactivated' : 'Staff activated');
      queryClient.invalidateQueries({ queryKey: ['all-staff'] });
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const openContractDrawer = (staff: UnifiedStaff) => {
    setSelectedEmployee({
      id: staff.id,
      user_id: staff.user_id,
      employee_code: staff.code,
      department: staff.department,
      position: staff.position,
      profiles: { full_name: staff.name, email: staff.email },
    });
    setContractOpen(true);
  };

  // Get unique departments for filter
  const departments = [...new Set(allStaff.map(s => s.department).filter(Boolean))];

  // Filter staff
  const filteredStaff = allStaff.filter((staff) => {
    const matchesSearch = search === '' || 
      staff.name?.toLowerCase().includes(search.toLowerCase()) ||
      staff.code?.toLowerCase().includes(search.toLowerCase()) ||
      staff.email?.toLowerCase().includes(search.toLowerCase()) ||
      staff.phone?.includes(search);
    
    const matchesDepartment = departmentFilter === 'all' || staff.department === departmentFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && staff.is_active) ||
      (statusFilter === 'inactive' && !staff.is_active);
    const matchesType = staffTypeFilter === 'all' || staff.staff_type === staffTypeFilter;
    
    return matchesSearch && matchesDepartment && matchesStatus && matchesType;
  });

  // Stats
  const stats = {
    total: allStaff.length,
    employees: allStaff.filter(s => s.staff_type === 'employee').length,
    trainers: allStaff.filter(s => s.staff_type === 'trainer').length,
    active: allStaff.filter(s => s.is_active).length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">All Staff</h1>
            <p className="text-muted-foreground">Manage employees, trainers, and staff records</p>
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
                Total Staff
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-purple-600" />
                Trainers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{stats.trainers}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Employees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.employees}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{stats.active}</div>
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
              <Select value={staffTypeFilter} onValueChange={(v) => setStaffTypeFilter(v as StaffType)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Staff Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="employee">Employees</SelectItem>
                  <SelectItem value="trainer">Trainers</SelectItem>
                </SelectContent>
              </Select>
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

        {/* Staff Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Staff ({filteredStaff.length})</CardTitle>
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
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Type</TableHead>
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
                  {filteredStaff.map((staff) => (
                    <TableRow key={`${staff.staff_type}-${staff.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={staff.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {staff.name?.[0] || 'S'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{staff.name || 'N/A'}</div>
                            <div className="text-sm text-muted-foreground">{staff.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={staff.staff_type === 'trainer' 
                            ? 'bg-purple-500/10 text-purple-600 border-purple-500/30' 
                            : 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                          }
                        >
                          {staff.staff_type === 'trainer' && <Dumbbell className="h-3 w-3 mr-1" />}
                          {staff.staff_type.charAt(0).toUpperCase() + staff.staff_type.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{staff.code || '-'}</TableCell>
                      <TableCell>{staff.department || '-'}</TableCell>
                      <TableCell>
                        {staff.position || '-'}
                        {staff.specialization && (
                          <span className="block text-xs text-muted-foreground">{staff.specialization}</span>
                        )}
                      </TableCell>
                      <TableCell>{staff.branch_name || '-'}</TableCell>
                      <TableCell>
                        <Badge className={staff.is_active ? 'bg-success/10 text-success border-success/30' : 'bg-muted text-muted-foreground'}>
                          {staff.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(staff.hire_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openContractDrawer(staff)}
                            title="Create Contract"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActive(staff)}
                            title={staff.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {staff.is_active ? (
                              <UserMinus className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredStaff.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {search || departmentFilter !== 'all' || statusFilter !== 'all' || staffTypeFilter !== 'all'
                          ? 'No staff match your filters'
                          : 'No staff found'}
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
