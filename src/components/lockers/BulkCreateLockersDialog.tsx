import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface BulkCreateLockersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
}

export function BulkCreateLockersDialog({ open, onOpenChange, branchId }: BulkCreateLockersDialogProps) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    prefix: 'L',
    startNumber: 1,
    endNumber: 10,
    size: 'medium',
    monthlyFee: 0,
  });

  const previewLockers = () => {
    const lockers = [];
    for (let i = formData.startNumber; i <= formData.endNumber; i++) {
      lockers.push(`${formData.prefix}-${i.toString().padStart(3, '0')}`);
    }
    return lockers;
  };

  const lockersToCreate = previewLockers();
  const lockerCount = lockersToCreate.length;

  const handleSubmit = async () => {
    if (lockerCount === 0 || lockerCount > 100) {
      toast.error('Please select between 1 and 100 lockers');
      return;
    }

    setIsCreating(true);
    try {
      const lockersData = lockersToCreate.map(lockerNumber => ({
        branch_id: branchId,
        locker_number: lockerNumber,
        size: formData.size,
        monthly_fee: formData.monthlyFee,
        status: 'available' as const,
      }));

      const { error } = await supabase
        .from('lockers')
        .insert(lockersData);

      if (error) throw error;

      toast.success(`Successfully created ${lockerCount} lockers`);
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      onOpenChange(false);
      setFormData({
        prefix: 'L',
        startNumber: 1,
        endNumber: 10,
        size: 'medium',
        monthlyFee: 0,
      });
    } catch (error: any) {
      console.error('Error creating lockers:', error);
      toast.error(error.message || 'Failed to create lockers');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Create Lockers</DialogTitle>
          <DialogDescription>
            Create multiple lockers at once with a common prefix and numbering
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Prefix</Label>
              <Input
                value={formData.prefix}
                onChange={(e) => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })}
                placeholder="L"
                maxLength={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Start Number</Label>
              <Input
                type="number"
                min={1}
                value={formData.startNumber}
                onChange={(e) => setFormData({ ...formData, startNumber: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label>End Number</Label>
              <Input
                type="number"
                min={formData.startNumber}
                value={formData.endNumber}
                onChange={(e) => setFormData({ ...formData, endNumber: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Size (all)</Label>
              <Select
                value={formData.size}
                onValueChange={(value) => setFormData({ ...formData, size: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monthly Fee (₹)</Label>
              <Input
                type="number"
                min={0}
                value={formData.monthlyFee}
                onChange={(e) => setFormData({ ...formData, monthlyFee: parseFloat(e.target.value) || 0 })}
                placeholder="0 for free"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview ({lockerCount} lockers)</Label>
            <ScrollArea className="h-32 border rounded-lg p-3">
              <div className="flex flex-wrap gap-2">
                {lockersToCreate.slice(0, 50).map((locker) => (
                  <Badge key={locker} variant="secondary" className="text-xs">
                    {locker}
                  </Badge>
                ))}
                {lockerCount > 50 && (
                  <Badge variant="outline" className="text-xs">
                    +{lockerCount - 50} more
                  </Badge>
                )}
              </div>
            </ScrollArea>
          </div>

          {lockerCount > 100 && (
            <p className="text-sm text-destructive">Maximum 100 lockers can be created at once</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isCreating || lockerCount === 0 || lockerCount > 100}
          >
            {isCreating ? 'Creating...' : `Create ${lockerCount} Lockers`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}