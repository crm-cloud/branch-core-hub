import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { communicationService } from '@/services/communicationService';
import { toast } from 'sonner';

interface AddAnnouncementDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAnnouncementDrawer({ open, onOpenChange }: AddAnnouncementDrawerProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    target_audience: 'all',
    priority: 0,
    is_active: true,
  });

  const createMutation = useMutation({
    mutationFn: () => communicationService.createAnnouncement(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      onOpenChange(false);
      setFormData({ title: '', content: '', target_audience: 'all', priority: 0, is_active: true });
      toast.success('Announcement created');
    },
    onError: () => toast.error('Failed to create announcement'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Announcement</SheetTitle>
          <SheetDescription>Create a new announcement for your members</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Announcement title"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Content *</Label>
            <Textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Announcement content..."
              rows={4}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Target Audience</Label>
            <Select value={formData.target_audience} onValueChange={(v) => setFormData({ ...formData, target_audience: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                <SelectItem value="active">Active Members</SelectItem>
                <SelectItem value="staff">Staff Only</SelectItem>
                <SelectItem value="trainers">Trainers Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Priority (0-10)</Label>
            <Input
              type="number"
              min={0}
              max={10}
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
            />
          </div>
          
          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Active</Label>
              <p className="text-xs text-muted-foreground">Show announcement to members</p>
            </div>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={() => createMutation.mutate()} 
            disabled={!formData.title || !formData.content || createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Announcement'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
