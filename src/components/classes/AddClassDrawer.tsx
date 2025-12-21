import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useCreateClass } from '@/hooks/useClasses';
import { useTrainers } from '@/hooks/useTrainers';

interface AddClassDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
}

export function AddClassDrawer({ open, onOpenChange, branchId }: AddClassDrawerProps) {
  const createClass = useCreateClass();
  const { data: trainers } = useTrainers(branchId);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    capacity: 20,
    duration_minutes: 60,
    scheduled_at: '',
    trainer_id: '',
    class_type: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.scheduled_at || !branchId) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      await createClass.mutateAsync({
        ...formData,
        branch_id: branchId,
        trainer_id: formData.trainer_id || null,
        scheduled_at: new Date(formData.scheduled_at).toISOString(),
      });
      toast.success('Class created successfully');
      onOpenChange(false);
      setFormData({
        name: '',
        description: '',
        capacity: 20,
        duration_minutes: 60,
        scheduled_at: '',
        trainer_id: '',
        class_type: '',
      });
    } catch (error) {
      toast.error('Failed to create class');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create New Class</SheetTitle>
          <SheetDescription>Schedule a new group class</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Class Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Yoga, HIIT, Spin, etc."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Class Type</Label>
              <Select
                value={formData.class_type}
                onValueChange={(value) => setFormData({ ...formData, class_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yoga">Yoga</SelectItem>
                  <SelectItem value="hiit">HIIT</SelectItem>
                  <SelectItem value="spin">Spin</SelectItem>
                  <SelectItem value="strength">Strength</SelectItem>
                  <SelectItem value="cardio">Cardio</SelectItem>
                  <SelectItem value="dance">Dance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Capacity *</Label>
              <Input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 20 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date & Time *</Label>
              <Input
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 60 })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Trainer</Label>
            <Select
              value={formData.trainer_id || "none"}
              onValueChange={(value) => setFormData({ ...formData, trainer_id: value === "none" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select trainer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No trainer</SelectItem>
                {trainers?.map((trainer: any) => (
                  <SelectItem key={trainer.id} value={trainer.id}>
                    {trainer.profile_name || trainer.profile_email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Class description..."
              rows={3}
            />
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createClass.isPending}>
              {createClass.isPending ? 'Creating...' : 'Create Class'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
