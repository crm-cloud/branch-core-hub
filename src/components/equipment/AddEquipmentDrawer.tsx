import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createEquipment, updateEquipment, type Equipment } from '@/services/equipmentService';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { PRIMARY_CATEGORIES, MUSCLE_GROUPS, MOVEMENT_PATTERNS } from '@/lib/equipment/taxonomy';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface AddEquipmentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  equipmentToEdit?: Equipment | null;
}

const getInitialFormData = (equipment?: Equipment | null) => ({
  name: equipment?.name || '',
  brand: equipment?.brand || '',
  model: equipment?.model || '',
  serialNumber: equipment?.serial_number || '',
  category: equipment?.category || '',
  primaryCategory: equipment?.primary_category || '',
  muscleGroups: (equipment?.muscle_groups ?? []) as string[],
  movementPattern: equipment?.movement_pattern || '',
  location: equipment?.location || '',
  purchaseDate: equipment?.purchase_date || '',
  purchasePrice: equipment?.purchase_price ? String(equipment.purchase_price) : '',
  warrantyExpiry: equipment?.warranty_expiry || '',
  notes: equipment?.notes || '',
});

export function AddEquipmentDrawer({ open, onOpenChange, branchId, equipmentToEdit }: AddEquipmentDrawerProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(getInitialFormData(equipmentToEdit));

  const invalidateEquipmentQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['equipment', branchId] });
    queryClient.invalidateQueries({ queryKey: ['equipment'] });
    queryClient.invalidateQueries({ queryKey: ['equipment-list'] });
    queryClient.invalidateQueries({ queryKey: ['equipment-stats'] });
  };

  useEffect(() => {
    if (!open) return;
    setFormData(getInitialFormData(equipmentToEdit));
  }, [open, equipmentToEdit]);

  const createMutation = useMutation({
    mutationFn: () => createEquipment({
      branchId,
      name: formData.name,
      brand: formData.brand || undefined,
      model: formData.model || undefined,
      serialNumber: formData.serialNumber || undefined,
      category: formData.category || undefined,
      location: formData.location || undefined,
      purchaseDate: formData.purchaseDate || undefined,
      purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : undefined,
      warrantyExpiry: formData.warrantyExpiry || undefined,
    }),
    onSuccess: () => {
      toast.success('Equipment added successfully');
      invalidateEquipmentQueries();
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      // Provide clear error messages for RLS/permission issues
      const message = error.message || 'Failed to add equipment';
      if (message.includes('violates row-level security') || message.includes('permission denied')) {
        toast.error('Permission denied. You need admin/manager/staff role to add equipment.');
      } else {
        toast.error('Failed to add equipment: ' + message);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!equipmentToEdit) throw new Error('Equipment not selected for edit');
      return updateEquipment(equipmentToEdit.id, {
        name: formData.name,
        brand: formData.brand || null,
        model: formData.model || null,
        serial_number: formData.serialNumber || null,
        category: formData.category || null,
        location: formData.location || null,
        purchase_date: formData.purchaseDate || null,
        purchase_price: formData.purchasePrice ? parseFloat(formData.purchasePrice) : null,
        warranty_expiry: formData.warrantyExpiry || null,
        notes: formData.notes || null,
      });
    },
    onSuccess: () => {
      toast.success('Equipment updated successfully');
      invalidateEquipmentQueries();
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error('Failed to update equipment: ' + (error.message || 'Unknown error'));
    },
  });

  const resetForm = () => {
    setFormData(getInitialFormData(null));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Equipment name is required');
      return;
    }
    if (!equipmentToEdit && !branchId) {
      toast.error('Branch is not selected');
      return;
    }
    if (equipmentToEdit) {
      updateMutation.mutate();
      return;
    }
    createMutation.mutate();
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isEditMode = Boolean(equipmentToEdit);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditMode ? 'Edit Equipment' : 'Add New Equipment'}</SheetTitle>
          <SheetDescription>
            {isEditMode ? 'Update machine details and tracking metadata' : 'Add equipment to track in your gym'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Equipment Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Treadmill, Bench Press"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="e.g., Life Fitness"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="e.g., T5-GO"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat.toLowerCase()}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Cardio Zone"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="serialNumber">Serial Number</Label>
            <Input
              id="serialNumber"
              value={formData.serialNumber}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              placeholder="Equipment serial number"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Purchase Date</Label>
              <Input
                id="purchaseDate"
                type="date"
                value={formData.purchaseDate}
                onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchasePrice">Purchase Price (₹)</Label>
              <Input
                id="purchasePrice"
                type="number"
                value={formData.purchasePrice}
                onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="warrantyExpiry">Warranty Expiry</Label>
            <Input
              id="warrantyExpiry"
              type="date"
              value={formData.warrantyExpiry}
              onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional notes about this machine"
            />
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (isEditMode ? 'Saving...' : 'Adding...') : (isEditMode ? 'Save Changes' : 'Add Equipment')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
