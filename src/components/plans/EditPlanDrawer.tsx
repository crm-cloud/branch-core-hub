import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useUpdatePlan } from '@/hooks/usePlans';
import { toast } from 'sonner';
import type { MembershipPlanWithBenefits } from '@/types/membership';

interface EditPlanDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: MembershipPlanWithBenefits | null;
}

export function EditPlanDrawer({ open, onOpenChange, plan }: EditPlanDrawerProps) {
  const updatePlan = useUpdatePlan();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    discounted_price: '',
    duration_days: 30,
    admission_fee: 0,
    max_freeze_days: 0,
    is_transferable: false,
    is_active: true,
  });

  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name || '',
        description: plan.description || '',
        price: plan.price || 0,
        discounted_price: plan.discounted_price?.toString() || '',
        duration_days: plan.duration_days || 30,
        admission_fee: plan.admission_fee || 0,
        max_freeze_days: plan.max_freeze_days || 0,
        is_transferable: plan.is_transferable || false,
        is_active: plan.is_active ?? true,
      });
    }
  }, [plan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan || !formData.name || !formData.price) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      await updatePlan.mutateAsync({
        planId: plan.id,
        data: {
          name: formData.name,
          description: formData.description || undefined,
          price: formData.price,
          discounted_price: formData.discounted_price ? Number(formData.discounted_price) : undefined,
          duration_days: formData.duration_days,
          admission_fee: formData.admission_fee || undefined,
          max_freeze_days: formData.max_freeze_days || undefined,
          is_transferable: formData.is_transferable,
          is_active: formData.is_active,
        },
      });

      toast.success('Plan updated successfully');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating plan:', error);
      toast.error(error.message || 'Failed to update plan');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Membership Plan</SheetTitle>
          <SheetDescription>Update plan details and settings</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Plan Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Monthly Basic, Annual Premium, etc."
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Plan description..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price (₹) *</Label>
              <Input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Discounted Price (₹)</Label>
              <Input
                type="number"
                value={formData.discounted_price}
                onChange={(e) => setFormData({ ...formData, discounted_price: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duration (days) *</Label>
              <Input
                type="number"
                value={formData.duration_days}
                onChange={(e) => setFormData({ ...formData, duration_days: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Admission Fee (₹)</Label>
              <Input
                type="number"
                value={formData.admission_fee}
                onChange={(e) => setFormData({ ...formData, admission_fee: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Max Freeze Days</Label>
            <Input
              type="number"
              value={formData.max_freeze_days}
              onChange={(e) => setFormData({ ...formData, max_freeze_days: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Transferable</Label>
              <p className="text-xs text-muted-foreground">Allow membership transfer</p>
            </div>
            <Switch
              checked={formData.is_transferable}
              onCheckedChange={(checked) => setFormData({ ...formData, is_transferable: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Active</Label>
              <p className="text-xs text-muted-foreground">Show plan in purchase options</p>
            </div>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updatePlan.isPending}>
              {updatePlan.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
