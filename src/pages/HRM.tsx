import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Users, FileText, Calendar, DollarSign } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchEmployees, fetchEmployeeContracts, createContract } from '@/services/hrmService';
import { useState } from 'react';
import { toast } from 'sonner';

export default function HRMPage() {
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['hrm-employees'],
    queryFn: () => fetchEmployees(),
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['employee-contracts', selectedEmployee],
    queryFn: () => fetchEmployeeContracts(selectedEmployee!),
    enabled: !!selectedEmployee,
  });

  const createContractMutation = useMutation({
    mutationFn: createContract,
    onSuccess: () => {
      toast.success('Contract created successfully');
      queryClient.invalidateQueries({ queryKey: ['employee-contracts'] });
      setContractDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Failed to create contract: ' + error.message);
    },
  });

  const stats = {
    total: employees.length,
    active: employees.filter((e: any) => e.is_active).length,
    totalSalary: employees.reduce((sum: number, e: any) => sum + (e.salary || 0), 0),
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500/10 text-green-500',
      draft: 'bg-muted text-muted-foreground',
      pending: 'bg-yellow-500/10 text-yellow-500',
      expired: 'bg-destructive/10 text-destructive',
      terminated: 'bg-destructive/10 text-destructive',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Human Resources</h1>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Inactive</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{stats.total - stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Payroll</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">₹{stats.totalSalary.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="employees">
          <TabsList>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>All Employees</CardTitle>
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
                        <TableHead>Salary</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((employee: any) => (
                        <TableRow key={employee.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Users className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <div className="font-medium">{employee.profile?.full_name || 'N/A'}</div>
                                <div className="text-sm text-muted-foreground">{employee.profile?.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">{employee.employee_code}</TableCell>
                          <TableCell>{employee.department || '-'}</TableCell>
                          <TableCell>{employee.position || '-'}</TableCell>
                          <TableCell>₹{(employee.salary || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={employee.is_active ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}>
                              {employee.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Dialog open={contractDialogOpen && selectedEmployee === employee.id} onOpenChange={(open) => {
                              setContractDialogOpen(open);
                              if (open) setSelectedEmployee(employee.id);
                            }}>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <FileText className="mr-1 h-3 w-3" />
                                  Contract
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Create Contract</DialogTitle>
                                </DialogHeader>
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    const form = e.target as HTMLFormElement;
                                    const formData = new FormData(form);
                                    createContractMutation.mutate({
                                      employeeId: employee.id,
                                      contractType: formData.get('contractType') as string,
                                      startDate: formData.get('startDate') as string,
                                      endDate: formData.get('endDate') as string || undefined,
                                      salary: Number(formData.get('salary')),
                                    });
                                  }}
                                  className="space-y-4"
                                >
                                  <div className="space-y-2">
                                    <Label htmlFor="contractType">Contract Type</Label>
                                    <Select name="contractType" defaultValue="full_time">
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="full_time">Full Time</SelectItem>
                                        <SelectItem value="part_time">Part Time</SelectItem>
                                        <SelectItem value="contract">Contract</SelectItem>
                                        <SelectItem value="internship">Internship</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="startDate">Start Date</Label>
                                      <Input type="date" name="startDate" required />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="endDate">End Date</Label>
                                      <Input type="date" name="endDate" />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="salary">Monthly Salary</Label>
                                    <Input type="number" name="salary" defaultValue={employee.salary || 0} required />
                                  </div>
                                  <Button type="submit" className="w-full" disabled={createContractMutation.isPending}>
                                    {createContractMutation.isPending ? 'Creating...' : 'Create Contract'}
                                  </Button>
                                </form>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                      {employees.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No employees found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contracts" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Contracts</CardTitle>
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
                    {contracts.map((contract: any) => (
                      <TableRow key={contract.id}>
                        <TableCell>{selectedEmployee}</TableCell>
                        <TableCell className="capitalize">{contract.contract_type.replace('_', ' ')}</TableCell>
                        <TableCell>{new Date(contract.start_date).toLocaleDateString()}</TableCell>
                        <TableCell>{contract.end_date ? new Date(contract.end_date).toLocaleDateString() : 'Ongoing'}</TableCell>
                        <TableCell>₹{contract.salary.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(contract.status)}>{contract.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {contracts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Select an employee to view contracts
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payroll" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Payroll Summary</CardTitle>
              </CardHeader>
              <CardContent className="py-12 text-center">
                <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Payroll processing coming soon</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
