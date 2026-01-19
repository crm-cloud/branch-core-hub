import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useUpdateClass } from '@/hooks/useClasses';
import { useTrainers } from '@/hooks/useTrainers';
import { format } from 'date-fns';
import { AlertTriangle, Phone, Mail, User } from 'lucide-react';
import type { ClassWithDetails } from '@/services/classService';

interface EditClassDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classData: ClassWithDetails | null;
  branchId: string;
}

export function EditClassDrawer({ open, onOpenChange, classData, branchId }: EditClassDrawerProps) {
  const updateClass = useUpdateClass();
  const { data: trainers } = useTrainers(branchId);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    capacity: 20,
    duration_minutes: 60,
    scheduled_at: '',
    trainer_id: '',
    class_type: '',
    is_active: true,
  });

  useEffect(() => {
    if (classData) {
      setFormData({
        name: classData.name,
        description: classData.description || '',
        capacity: classData.capacity,
        duration_minutes: classData.duration_minutes || 60,
        scheduled_at: classData.scheduled_at ? format(new Date(classData.scheduled_at), "yyyy-MM-dd'T'HH:mm") : '',
        trainer_id: classData.trainer_id || '',
        class_type: classData.class_type || '',
        is_active: classData.is_active ?? true,
      });
    }
  }, [classData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classData || !formData.name || !formData.scheduled_at) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      await updateClass.mutateAsync({
        classId: classData.id,
        updates: {
          ...formData,
          trainer_id: formData.trainer_id || null,
          scheduled_at: new Date(formData.scheduled_at).toISOString(),
        },
      });
      toast.success('Class updated successfully');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to update class');
    }
  };

  const handleCancelClass = async () => {
    if (!classData) return;
    
    try {
      await updateClass.mutateAsync({
        classId: classData.id,
        updates: { is_active: false },
      });
      toast.success('Class cancelled successfully');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to cancel class');
    }
  };

  const selectedTrainer = trainers?.find((t: any) => t.id === formData.trainer_id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Class</SheetTitle>
          <SheetDescription>Update class details and schedule</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Active Status Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-base">Active Status</Label>
              <p className="text-sm text-muted-foreground">
                {formData.is_active ? 'Class is active and visible' : 'Class is cancelled/hidden'}
              </p>
            </div>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          {/* Current Bookings Info */}
          {classData && (
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {classData.bookings_count || 0}/{classData.capacity} Booked
              </Badge>
              {(classData.waitlist_count || 0) > 0 && (
                <Badge variant="secondary">
                  {classData.waitlist_count} Waitlisted
                </Badge>
              )}
            </div>
          )}

          <Separator />

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
                  <SelectItem value="pilates">Pilates</SelectItem>
                  <SelectItem value="boxing">Boxing</SelectItem>
                  <SelectItem value="crossfit">CrossFit</SelectItem>
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

          {/* Trainer Contact Info */}
          {selectedTrainer && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4" />
                Trainer Contact
              </div>
              {selectedTrainer.profile_phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {selectedTrainer.profile_phone}
                </div>
              )}
              {selectedTrainer.profile_email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {selectedTrainer.profile_email}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Class description..."
              rows={3}
            />
          </div>

          <SheetFooter className="pt-4 flex-col gap-2">
            <div className="flex gap-2 w-full">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={updateClass.isPending} className="flex-1">
                {updateClass.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
            
            {formData.is_active && classData && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancelClass}
                className="w-full"
                disabled={updateClass.isPending}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Cancel This Class
              </Button>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
