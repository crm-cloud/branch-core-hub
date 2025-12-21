import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useBranches } from '@/hooks/useBranches';

interface AddEmployeeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddEmployeeDrawer({ open, onOpenChange }: AddEmployeeDrawerProps) {
  const queryClient = useQueryClient();
  const { data: branches = [] } = useBranches();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    user_id: '',
    branch_id: '',
    department: '',
    position: '',
    hire_date: new Date().toISOString().split('T')[0],
    salary: '',
    salary_type: 'monthly',
    role: 'staff' as 'staff' | 'manager',
  });

  const { data: availableUsers = [] } = useQuery({
    queryKey: ['available-users-for-employees'],
    queryFn: async () => {
      const { data: existingEmployees } = await supabase
        .from('employees')
        .select('user_id');
      
      const existingUserIds = (existingEmployees || []).map((e) => e.user_id);

      const { data: users } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('is_active', true);

      return (users || []).filter((u) => !existingUserIds.includes(u.id));
    },
    enabled: open,
  });

  const generateEmployeeCode = (branchCode: string) => {
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `EMP-${branchCode}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.user_id || !formData.branch_id) {
      toast.error('Please select a user and branch');
      return;
    }

    setIsSubmitting(true);
    try {
      const branch = branches.find((b: any) => b.id === formData.branch_id);
      const employeeCode = generateEmployeeCode(branch?.code || 'XX');

      const { error } = await supabase.from('employees').insert({
        user_id: formData.user_id,
        branch_id: formData.branch_id,
        employee_code: employeeCode,
        department: formData.department || null,
        position: formData.position || null,
        hire_date: formData.hire_date,
        salary: formData.salary ? Number(formData.salary) : null,
        salary_type: formData.salary_type,
        is_active: true,
      });

      if (error) throw error;

      // Assign role to user
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: formData.user_id,
        role: formData.role,
      });

      if (roleError && !roleError.message.includes('duplicate')) {
        console.error('Role assignment error:', roleError);
      }

      // Add to staff_branches for branch access
      const { error: branchError } = await supabase.from('staff_branches').insert({
        user_id: formData.user_id,
        branch_id: formData.branch_id,
      });

      if (branchError && !branchError.message.includes('duplicate')) {
        console.error('Branch assignment error:', branchError);
      }

      // If manager, also add to branch_managers
      if (formData.role === 'manager') {
        await supabase.from('branch_managers').insert({
          user_id: formData.user_id,
          branch_id: formData.branch_id,
        });
      }

      toast.success('Employee added successfully');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      onOpenChange(false);
      setFormData({
        user_id: '',
        branch_id: '',
        department: '',
        position: '',
        hire_date: new Date().toISOString().split('T')[0],
        salary: '',
        salary_type: 'monthly',
        role: 'staff',
      });
    } catch (error: any) {
      console.error('Error adding employee:', error);
      toast.error(error.message || 'Failed to add employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Employee</SheetTitle>
          <SheetDescription>Link a user as an employee of your gym</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>User *</Label>
            <Select
              value={formData.user_id}
              onValueChange={(value) => setFormData({ ...formData, user_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user: any) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Branch *</Label>
            <Select
              value={formData.branch_id}
              onValueChange={(value) => setFormData({ ...formData, branch_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch: any) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value: 'staff' | 'manager') => setFormData({ ...formData, role: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Input
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="Operations, Sales, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Input
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="Manager, Staff, etc."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Hire Date</Label>
            <Input
              type="date"
              value={formData.hire_date}
              onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Salary (₹)</Label>
              <Input
                type="number"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Salary Type</Label>
              <Select
                value={formData.salary_type}
                onValueChange={(value) => setFormData({ ...formData, salary_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Employee'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
