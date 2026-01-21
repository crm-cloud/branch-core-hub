import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useUpdatePTPackage } from '@/hooks/usePTPackages';

const SESSION_TYPES = [
  { value: 'per_session', label: 'Per Session' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'custom', label: 'Custom' },
];

interface EditPTPackageDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  package: any;
}

export function EditPTPackageDrawer({ open, onOpenChange, package: pkg }: EditPTPackageDrawerProps) {
  const updatePackage = useUpdatePTPackage();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    total_sessions: 10,
    price: 0,
    validity_days: 90,
    session_type: 'per_session',
    gst_inclusive: false,
    gst_percentage: 18,
    is_active: true,
  });

  useEffect(() => {
    if (pkg) {
      setFormData({
        name: pkg.name || '',
        description: pkg.description || '',
        total_sessions: pkg.total_sessions || 10,
        price: pkg.price || 0,
        validity_days: pkg.validity_days || 90,
        session_type: pkg.session_type || 'per_session',
        gst_inclusive: pkg.gst_inclusive || false,
        gst_percentage: pkg.gst_percentage || 18,
        is_active: pkg.is_active !== false,
      });
    }
  }, [pkg]);

  const calculateGSTAmount = (price: number, gstPercentage: number, isInclusive: boolean) => {
    if (isInclusive) {
      return price - (price / (1 + gstPercentage / 100));
    }
    return price * (gstPercentage / 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      await updatePackage.mutateAsync({
        id: pkg.id,
        ...formData,
      });
      toast.success('PT Package updated');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to update package');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit PT Package</SheetTitle>
          <SheetDescription>Update package details</SheetDescription>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sessions *</Label>
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

          {/* Active Status Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <Label htmlFor="is-active">Package Status</Label>
              <p className="text-sm text-muted-foreground">
                {formData.is_active ? 'Active - available for purchase' : 'Inactive - hidden from members'}
              </p>
            </div>
            <Switch
              id="is-active"
              checked={formData.is_active}
              onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
            />
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updatePackage.isPending}>
              {updatePackage.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
