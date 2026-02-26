import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { StaffAvatarUpload } from '@/components/common/StaffAvatarUpload';
import { queueStaffSync } from '@/services/biometricService';
import { DEPARTMENTS, POSITIONS, SALARY_TYPES } from '@/constants/employeeConstants';

interface EditEmployeeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: any;
}

export function EditEmployeeDrawer({ open, onOpenChange, employee }: EditEmployeeDrawerProps) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  
  const [formData, setFormData] = useState({
    department: '',
    position: '',
    salary: 0,
    salary_type: 'monthly',
    bank_name: '',
    bank_account: '',
    tax_id: '',
    is_active: true,
  });

  const handleAvatarChange = async (url: string) => {
    setAvatarUrl(url);
    if (url && employee?.id) {
      if (employee.user_id) {
        await supabase.from('profiles').update({ avatar_url: url }).eq('id', employee.user_id);
      }
      try {
        await queueStaffSync(employee.id, url, employee.profile?.full_name || 'Employee');
      } catch (err) {
        console.warn('Biometric sync queue failed:', err);
      }
    }
  };

  useEffect(() => {
    if (employee) {
      setAvatarUrl(employee.profile?.avatar_url || employee.biometric_photo_url || '');
      setFormData({
        department: employee.department || '',
        position: employee.position || '',
        salary: employee.salary || 0,
        salary_type: employee.salary_type || 'monthly',
        bank_name: employee.bank_name || '',
        bank_account: employee.bank_account || '',
        tax_id: employee.tax_id || '',
        is_active: employee.is_active ?? true,
      });
    }
  }, [employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee?.id) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          department: formData.department || null,
          position: formData.position || null,
          salary: formData.salary,
          salary_type: formData.salary_type,
          bank_name: formData.bank_name || null,
          bank_account: formData.bank_account || null,
          tax_id: formData.tax_id || null,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', employee.id);

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['hrm-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['branch-managers'] });
      toast.success('Employee updated successfully');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update employee');
    } finally {
      setIsLoading(false);
    }
  };

  if (!employee) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Employee</SheetTitle>
          <SheetDescription>
            Update {employee.profile?.full_name}'s employment details
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Avatar Upload */}
          <div className="flex justify-center pb-2">
            <StaffAvatarUpload
              avatarUrl={avatarUrl}
              name={employee?.profile?.full_name || 'Employee'}
              onAvatarChange={handleAvatarChange}
              size="lg"
            />
          </div>

          {/* Branch (read-only) */}
          {employee.branch?.name && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Assigned Branch</Label>
              <div className="p-3 border rounded-lg bg-muted/30 font-medium text-sm">
                {employee.branch?.name || 'Not assigned'}
              </div>
            </div>
          )}

          {/* Employee Code (read-only) */}
          {employee.employee_code && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Employee Code</Label>
              <div className="p-3 border rounded-lg bg-muted/30 font-medium text-sm">
                {employee.employee_code}
              </div>
            </div>
          )}

          {/* Active Status */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Active Status</Label>
              <p className="text-xs text-muted-foreground">Inactive employees are not shown in reports</p>
            </div>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
            />
          </div>

          {/* Position & Department */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={formData.department}
                onValueChange={(v) => setFormData({ ...formData, department: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Select
                value={formData.position || 'none'}
                onValueChange={(v) => setFormData({ ...formData, position: v === 'none' ? '' : v })}
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

          {/* Compensation */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h4 className="font-medium">Compensation</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Salary Type</Label>
                <Select
                  value={formData.salary_type}
                  onValueChange={(v) => setFormData({ ...formData, salary_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SALARY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Salary (₹)</Label>
                <Input
                  type="number"
                  value={formData.salary}
                  onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h4 className="font-medium">Bank Details</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="e.g., HDFC Bank"
                />
              </div>
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input
                  value={formData.bank_account}
                  onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                  placeholder="Account number"
                />
              </div>
            </div>
          </div>

          {/* Tax ID */}
          <div className="space-y-2">
            <Label>PAN / Tax ID</Label>
            <Input
              value={formData.tax_id}
              onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
              placeholder="PAN number"
            />
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
