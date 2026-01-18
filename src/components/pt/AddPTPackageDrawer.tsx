import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useCreatePTPackage } from '@/hooks/usePTPackages';

const SESSION_TYPES = [
  { value: 'per_session', label: 'Per Session (Fixed sessions)' },
  { value: 'monthly', label: 'Monthly Subscription' },
  { value: 'quarterly', label: 'Quarterly Subscription' },
  { value: 'custom', label: 'Custom' },
];

interface AddPTPackageDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
}

export function AddPTPackageDrawer({ open, onOpenChange, branchId }: AddPTPackageDrawerProps) {
  const createPackage = useCreatePTPackage();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    total_sessions: 10,
    sessions_per_month: 8,
    price: 0,
    validity_days: 90,
    session_type: 'per_session',
    auto_renew: false,
    gst_inclusive: false,
    gst_percentage: 18,
  });

  const isSubscription = formData.session_type === 'monthly' || formData.session_type === 'quarterly';

  const calculateGSTAmount = (price: number, gstPercentage: number, isInclusive: boolean) => {
    if (isInclusive) {
      return price - (price / (1 + gstPercentage / 100));
    }
    return price * (gstPercentage / 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price || !branchId) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      await createPackage.mutateAsync({
        ...formData,
        branch_id: branchId,
      });
      toast.success('PT Package created');
      onOpenChange(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to create package');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      total_sessions: 10,
      sessions_per_month: 8,
      price: 0,
      validity_days: 90,
      session_type: 'per_session',
      auto_renew: false,
      gst_inclusive: false,
      gst_percentage: 18,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create PT Package</SheetTitle>
          <SheetDescription>Define a new personal training package</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Package Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="10 Sessions Package"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Session Type *</Label>
            <Select
              value={formData.session_type}
              onValueChange={(v) => setFormData({ ...formData, session_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SESSION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sessions - Different UI based on type */}
          {!isSubscription ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Sessions *</Label>
                <Input
                  type="number"
                  value={formData.total_sessions}
                  onChange={(e) => setFormData({ ...formData, total_sessions: parseInt(e.target.value) || 10 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Price (₹) *</Label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h4 className="text-sm font-medium">Subscription Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sessions per Month *</Label>
                  <Input
                    type="number"
                    value={formData.sessions_per_month}
                    onChange={(e) => setFormData({ ...formData, sessions_per_month: parseInt(e.target.value) || 8 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Price (₹) *</Label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.auto_renew}
                  onCheckedChange={(v) => setFormData({ ...formData, auto_renew: v })}
                />
                <div>
                  <Label>Auto Renew</Label>
                  <p className="text-xs text-muted-foreground">Automatically renew subscription each billing cycle</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>GST %</Label>
              <Input
                type="number"
                value={formData.gst_percentage}
                onChange={(e) => setFormData({ ...formData, gst_percentage: parseFloat(e.target.value) || 18 })}
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                checked={formData.gst_inclusive}
                onCheckedChange={(v) => setFormData({ ...formData, gst_inclusive: v })}
              />
              <Label>GST Inclusive</Label>
            </div>
          </div>

          {formData.price > 0 && (
            <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
              <p>
                <strong>Base Price:</strong> ₹
                {formData.gst_inclusive
                  ? (formData.price - calculateGSTAmount(formData.price, formData.gst_percentage, true)).toFixed(2)
                  : formData.price}
              </p>
              <p>
                <strong>GST ({formData.gst_percentage}%):</strong> ₹
                {calculateGSTAmount(formData.price, formData.gst_percentage, formData.gst_inclusive).toFixed(2)}
              </p>
              <p className="font-bold">
                <strong>Total:</strong> ₹
                {formData.gst_inclusive
                  ? formData.price
                  : (formData.price + calculateGSTAmount(formData.price, formData.gst_percentage, false)).toFixed(2)}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Validity (days)</Label>
            <Input
              type="number"
              value={formData.validity_days}
              onChange={(e) => setFormData({ ...formData, validity_days: parseInt(e.target.value) || 90 })}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Package details..."
            />
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPackage.isPending}>
              {createPackage.isPending ? 'Creating...' : 'Create Package'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
