import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCreateTrainer } from '@/hooks/useTrainers';

interface AddTrainerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
}

export function AddTrainerDrawer({ open, onOpenChange, branchId }: AddTrainerDrawerProps) {
  const [availableUsers, setAvailableUsers] = useState<{ id: string; email: string; full_name: string | null }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const createTrainer = useCreateTrainer();

  const [formData, setFormData] = useState({
    user_id: '',
    specializations: '',
    certifications: '',
    bio: '',
    hourly_rate: 0,
  });

  const loadAvailableUsers = async () => {
    if (!branchId) return;
    setLoadingUsers(true);
    try {
      const { data: existingTrainers } = await supabase
        .from('trainers')
        .select('user_id')
        .eq('branch_id', branchId);

      const existingUserIds = (existingTrainers || []).map((t) => t.user_id);

      const { data: users } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('is_active', true);

      const filtered = (users || []).filter((u) => !existingUserIds.includes(u.id));
      setAvailableUsers(filtered);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadAvailableUsers();
    }
  }, [open, branchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.user_id || !branchId) {
      toast.error('Please select a user');
      return;
    }

    try {
      await createTrainer.mutateAsync({
        branch_id: branchId,
        user_id: formData.user_id,
        specializations: formData.specializations
          ? formData.specializations.split(',').map((s) => s.trim())
          : null,
        certifications: formData.certifications
          ? formData.certifications.split(',').map((s) => s.trim())
          : null,
        bio: formData.bio || null,
        hourly_rate: formData.hourly_rate || null,
      });
      toast.success('Trainer profile created');
      onOpenChange(false);
      setFormData({
        user_id: '',
        specializations: '',
        certifications: '',
        bio: '',
        hourly_rate: 0,
      });
    } catch (error) {
      toast.error('Failed to create trainer profile');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Trainer Profile</SheetTitle>
          <SheetDescription>Link an existing user as a trainer for this branch</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>User *</Label>
            <Select
              value={formData.user_id}
              onValueChange={(value) => setFormData({ ...formData, user_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingUsers ? 'Loading...' : 'Select user'} />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Specializations</Label>
            <Input
              value={formData.specializations}
              onChange={(e) => setFormData({ ...formData, specializations: e.target.value })}
              placeholder="Yoga, HIIT, Strength (comma-separated)"
            />
          </div>

          <div className="space-y-2">
            <Label>Certifications</Label>
            <Input
              value={formData.certifications}
              onChange={(e) => setFormData({ ...formData, certifications: e.target.value })}
              placeholder="ACE, NASM, CPR (comma-separated)"
            />
          </div>

          <div className="space-y-2">
            <Label>Hourly Rate (₹)</Label>
            <Input
              type="number"
              value={formData.hourly_rate}
              onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Trainer bio and experience..."
              rows={4}
            />
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTrainer.isPending}>
              {createTrainer.isPending ? 'Creating...' : 'Add Trainer'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
