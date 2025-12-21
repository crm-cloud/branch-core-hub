import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leadService } from '@/services/leadService';
import { toast } from 'sonner';

interface AddLeadDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBranchId?: string;
}

export function AddLeadDrawer({ open, onOpenChange, defaultBranchId }: AddLeadDrawerProps) {
  const queryClient = useQueryClient();
  const [newLead, setNewLead] = useState({
    full_name: '',
    phone: '',
    email: '',
    source: 'walk_in',
    notes: '',
  });

  const createLeadMutation = useMutation({
    mutationFn: (lead: typeof newLead) => leadService.createLead({
      ...lead,
      branch_id: defaultBranchId || '',
      status: 'new',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      onOpenChange(false);
      setNewLead({ full_name: '', phone: '', email: '', source: 'walk_in', notes: '' });
      toast.success('Lead added successfully');
    },
    onError: () => toast.error('Failed to add lead'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add New Lead</SheetTitle>
          <SheetDescription>Create a new lead for follow-up</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input
              value={newLead.full_name}
              onChange={(e) => setNewLead({ ...newLead, full_name: e.target.value })}
              placeholder="Enter full name"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Phone *</Label>
            <Input
              value={newLead.phone}
              onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
              placeholder="+91 98765 43210"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={newLead.email}
              onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
              placeholder="email@example.com"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Source</Label>
            <Select value={newLead.source} onValueChange={(v) => setNewLead({ ...newLead, source: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walk_in">Walk-in</SelectItem>
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="social_media">Social Media</SelectItem>
                <SelectItem value="advertisement">Advertisement</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={newLead.notes}
              onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={() => createLeadMutation.mutate(newLead)} 
            disabled={!newLead.full_name || !newLead.phone || createLeadMutation.isPending}
          >
            {createLeadMutation.isPending ? 'Adding...' : 'Add Lead'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
