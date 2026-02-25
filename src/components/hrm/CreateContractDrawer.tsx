import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createContract } from '@/services/hrmService';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';

interface CreateContractDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: any;
}

export function CreateContractDrawer({ open, onOpenChange, employee }: CreateContractDrawerProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    contractType: 'full_time',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    salary: employee?.salary || 0,
    commissionPercentage: 0,
    terms: '',
    documentUrl: '',
  });

  const createContractMutation = useMutation({
    mutationFn: createContract,
    onSuccess: () => {
      toast.success('Contract created successfully');
      queryClient.invalidateQueries({ queryKey: ['employee-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['all-contracts'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to create contract: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      contractType: 'full_time',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      salary: employee?.salary || 0,
      commissionPercentage: 0,
      terms: '',
      documentUrl: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee?.id) return;

    // Check if this is a trainer (has staff_type = 'trainer') or regular employee
    const isTrainer = employee.staff_type === 'trainer';
    
    createContractMutation.mutate({
      employeeId: isTrainer ? undefined : employee.id,
      trainerId: isTrainer ? employee.id : undefined,
      contractType: formData.contractType,
      startDate: formData.startDate,
      endDate: formData.endDate || undefined,
      salary: Number(formData.salary),
      baseSalary: Number(formData.salary),
      commissionPercentage: Number(formData.commissionPercentage),
      terms: formData.terms ? { conditions: formData.terms } : undefined,
      documentUrl: formData.documentUrl || undefined,
    });
  };

  if (!employee) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />
            Create Contract
          </SheetTitle>
          <SheetDescription>
            Create a new contract for {employee.profile?.full_name || 'Employee'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Employee Info */}
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="font-medium">{employee.profile?.full_name}</p>
            <p className="text-sm text-muted-foreground">{employee.employee_code}</p>
            <p className="text-sm text-muted-foreground">{employee.position || 'No position'}</p>
          </div>

          <div className="space-y-2">
            <Label>Contract Type *</Label>
            <Select
              value={formData.contractType}
              onValueChange={(value) => setFormData({ ...formData, contractType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">Full Time</SelectItem>
                <SelectItem value="part_time">Part Time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
                <SelectItem value="probation">Probation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                placeholder="Leave empty for ongoing"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Base Salary (₹) *</Label>
              <Input
                type="number"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: Number(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Commission %</Label>
              <Input
                type="number"
                value={formData.commissionPercentage}
                onChange={(e) => setFormData({ ...formData, commissionPercentage: Number(e.target.value) })}
                min={0}
                max={100}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">PT session commission rate</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Terms & Conditions</Label>
            <Textarea
              value={formData.terms}
              onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
              placeholder="Notice period, working hours, PF/ESI details, leave policy..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Include Indian labor law essentials: notice period, PF/ESI, working hours, leave policy
            </p>
          </div>

          <div className="space-y-2">
            <Label>Contract Document (Upload)</Label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.png"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fileName = `contracts/${employee?.id || 'unknown'}/${Date.now()}-${file.name}`;
                const { error } = await (await import('@/integrations/supabase/client')).supabase.storage
                  .from('documents')
                  .upload(fileName, file);
                if (error) {
                  (await import('sonner')).toast.error('Upload failed: ' + error.message);
                } else {
                  const { data: urlData } = (await import('@/integrations/supabase/client')).supabase.storage
                    .from('documents')
                    .getPublicUrl(fileName);
                  setFormData({ ...formData, documentUrl: urlData.publicUrl });
                  (await import('sonner')).toast.success('Document uploaded');
                }
              }}
            />
            {formData.documentUrl && (
              <a href={formData.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline">
                View uploaded document
              </a>
            )}
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createContractMutation.isPending}>
              {createContractMutation.isPending ? 'Creating...' : 'Create Contract'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
