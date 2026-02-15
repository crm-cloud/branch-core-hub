import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useBranches } from '@/hooks/useBranches';
import { UserPlus, Link, Info } from 'lucide-react';
import { StaffAvatarUpload } from '@/components/common/StaffAvatarUpload';

const DEPARTMENTS = ['Management', 'Fitness', 'Sales', 'Operations', 'Maintenance'];
const POSITIONS = ['Gym Manager', 'Personal Trainer', 'Receptionist', 'Sales Rep', 'Cleaner'];

interface AddEmployeeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddEmployeeDrawer({ open, onOpenChange }: AddEmployeeDrawerProps) {
  const queryClient = useQueryClient();
  const { data: branches = [] } = useBranches();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'link'>('new');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Form data for linking existing user
  const [linkFormData, setLinkFormData] = useState({
    user_id: '',
    branch_id: '',
    department: '',
    position: '',
    hire_date: new Date().toISOString().split('T')[0],
    salary: '',
    salary_type: 'monthly',
    role: 'staff' as 'staff' | 'manager',
  });

  // Form data for creating new user (no password - edge function handles it)
  const [newUserFormData, setNewUserFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    branch_id: '',
    department: '',
    position: '',
    hire_date: new Date().toISOString().split('T')[0],
    salary: '',
    salary_type: 'monthly',
    role: 'staff' as 'staff' | 'manager',
  });

  // Fetch available users who are NOT already employees AND NOT members
  const { data: availableUsers = [] } = useQuery({
    queryKey: ['available-users-for-employees'],
    queryFn: async () => {
      const { data: existingEmployees } = await supabase
        .from('employees')
        .select('user_id');
      
      const existingEmployeeIds = (existingEmployees || []).map((e) => e.user_id);

      const { data: existingMembers } = await supabase
        .from('members')
        .select('user_id')
        .not('user_id', 'is', null);
      
      const existingMemberIds = (existingMembers || []).map((m) => m.user_id);

      const { data: users } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('is_active', true);

      return (users || []).filter((u) => 
        !existingEmployeeIds.includes(u.id) && 
        !existingMemberIds.includes(u.id)
      );
    },
    enabled: open,
  });

  const generateEmployeeCode = (branchCode: string) => {
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `EMP-${branchCode}-${random}`;
  };

  const handleLinkExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkFormData.user_id || !linkFormData.branch_id) {
      toast.error('Please select a user and branch');
      return;
    }

    setIsSubmitting(true);
    try {
      const branch = branches.find((b: any) => b.id === linkFormData.branch_id);
      const employeeCode = generateEmployeeCode(branch?.code || 'XX');

      const { error } = await supabase.from('employees').insert({
        user_id: linkFormData.user_id,
        branch_id: linkFormData.branch_id,
        employee_code: employeeCode,
        department: linkFormData.department || null,
        position: linkFormData.position || null,
        hire_date: linkFormData.hire_date,
        salary: linkFormData.salary ? Number(linkFormData.salary) : null,
        salary_type: linkFormData.salary_type,
        is_active: true,
      });

      if (error) throw error;

      await supabase.from('user_roles').insert({
        user_id: linkFormData.user_id,
        role: linkFormData.role,
      });

      await supabase.from('staff_branches').insert({
        user_id: linkFormData.user_id,
        branch_id: linkFormData.branch_id,
      });

      if (linkFormData.role === 'manager') {
        await supabase.from('branch_managers').insert({
          user_id: linkFormData.user_id,
          branch_id: linkFormData.branch_id,
        });
      }

      toast.success('Employee added successfully');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['available-users-for-employees'] });
      onOpenChange(false);
      resetForms();
    } catch (error: any) {
      console.error('Error adding employee:', error);
      toast.error(error.message || 'Failed to add employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserFormData.email || !newUserFormData.branch_id) {
      toast.error('Please fill in email and branch');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: result, error: createError } = await supabase.functions.invoke('create-staff-user', {
        body: {
          email: newUserFormData.email,
          fullName: newUserFormData.full_name,
          phone: newUserFormData.phone,
          role: newUserFormData.role,
          branchId: newUserFormData.branch_id,
          department: newUserFormData.department || undefined,
          position: newUserFormData.position || undefined,
          salary: newUserFormData.salary ? Number(newUserFormData.salary) : undefined,
          salaryType: newUserFormData.salary_type,
          hireDate: newUserFormData.hire_date,
        },
      });

      if (createError) throw createError;
      if (result?.error) throw new Error(result.error);

      toast.success('Employee created! They will receive a password setup prompt on first login.');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      onOpenChange(false);
      resetForms();
    } catch (error: any) {
      console.error('Error creating employee:', error);
      toast.error(error.message || 'Failed to create employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForms = () => {
    setAvatarUrl('');
    setLinkFormData({
      user_id: '',
      branch_id: '',
      department: '',
      position: '',
      hire_date: new Date().toISOString().split('T')[0],
      salary: '',
      salary_type: 'monthly',
      role: 'staff',
    });
    setNewUserFormData({
      email: '',
      full_name: '',
      phone: '',
      branch_id: '',
      department: '',
      position: '',
      hire_date: new Date().toISOString().split('T')[0],
      salary: '',
      salary_type: 'monthly',
      role: 'staff',
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Employee</SheetTitle>
          <SheetDescription>Create a new employee or link an existing user profile</SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'new' | 'link')} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Create New User
            </TabsTrigger>
            <TabsTrigger value="link" className="gap-2">
              <Link className="h-4 w-4" />
              Link Existing
            </TabsTrigger>
          </TabsList>

          {/* Create New User Tab */}
          <TabsContent value="new">
            <form onSubmit={handleCreateNew} className="space-y-4 py-4">
              <div className="p-3 rounded-lg bg-info/10 border border-info/30 text-sm flex items-start gap-2">
                <Info className="h-4 w-4 text-info mt-0.5 shrink-0" />
                <div>
                  <p className="text-info font-medium">Create New User</p>
                  <p className="text-muted-foreground">The employee will receive a password setup prompt on their first login.</p>
                </div>
              </div>

              {/* Avatar Upload */}
              <div className="flex justify-center pb-2">
                <StaffAvatarUpload
                  avatarUrl={avatarUrl}
                  name={newUserFormData.full_name || 'New Employee'}
                  onAvatarChange={setAvatarUrl}
                  size="lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    value={newUserFormData.full_name}
                    onChange={(e) => setNewUserFormData({ ...newUserFormData, full_name: e.target.value })}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={newUserFormData.phone}
                    onChange={(e) => setNewUserFormData({ ...newUserFormData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={newUserFormData.email}
                  onChange={(e) => setNewUserFormData({ ...newUserFormData, email: e.target.value })}
                  placeholder="employee@gym.com"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Branch *</Label>
                  <Select
                    value={newUserFormData.branch_id}
                    onValueChange={(value) => setNewUserFormData({ ...newUserFormData, branch_id: value })}
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
                    value={newUserFormData.role}
                    onValueChange={(value: 'staff' | 'manager') => setNewUserFormData({ ...newUserFormData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={newUserFormData.department || 'none'}
                    onValueChange={(value) => setNewUserFormData({ ...newUserFormData, department: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select
                    value={newUserFormData.position || 'none'}
                    onValueChange={(value) => setNewUserFormData({ ...newUserFormData, position: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {POSITIONS.map((pos) => (
                        <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hire Date</Label>
                  <Input
                    type="date"
                    value={newUserFormData.hire_date}
                    onChange={(e) => setNewUserFormData({ ...newUserFormData, hire_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Salary (₹)</Label>
                  <Input
                    type="number"
                    value={newUserFormData.salary}
                    onChange={(e) => setNewUserFormData({ ...newUserFormData, salary: e.target.value })}
                    placeholder="Monthly salary"
                  />
                </div>
              </div>

              <SheetFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Employee'}
                </Button>
              </SheetFooter>
            </form>
          </TabsContent>

          {/* Link Existing User Tab */}
          <TabsContent value="link">
            <form onSubmit={handleLinkExisting} className="space-y-4 py-4">
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
                <p className="text-warning font-medium">Link Existing Profile</p>
                <p className="text-muted-foreground">Only profiles that are NOT linked to members are shown.</p>
              </div>

              <div className="space-y-2">
                <Label>User *</Label>
                <Select
                  value={linkFormData.user_id}
                  onValueChange={(value) => setLinkFormData({ ...linkFormData, user_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No available users found
                      </div>
                    ) : (
                      availableUsers.map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Branch *</Label>
                  <Select
                    value={linkFormData.branch_id}
                    onValueChange={(value) => setLinkFormData({ ...linkFormData, branch_id: value })}
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
                    value={linkFormData.role}
                    onValueChange={(value: 'staff' | 'manager') => setLinkFormData({ ...linkFormData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={linkFormData.department || 'none'}
                    onValueChange={(value) => setLinkFormData({ ...linkFormData, department: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select
                    value={linkFormData.position || 'none'}
                    onValueChange={(value) => setLinkFormData({ ...linkFormData, position: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {POSITIONS.map((pos) => (
                        <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hire Date</Label>
                  <Input
                    type="date"
                    value={linkFormData.hire_date}
                    onChange={(e) => setLinkFormData({ ...linkFormData, hire_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Salary (₹)</Label>
                  <Input
                    type="number"
                    value={linkFormData.salary}
                    onChange={(e) => setLinkFormData({ ...linkFormData, salary: e.target.value })}
                    placeholder="Monthly salary"
                  />
                </div>
              </div>

              <SheetFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || availableUsers.length === 0}>
                  {isSubmitting ? 'Adding...' : 'Add Employee'}
                </Button>
              </SheetFooter>
            </form>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
