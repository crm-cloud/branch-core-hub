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

interface FollowupDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: any | null;
}

export function FollowupDrawer({ open, onOpenChange, lead }: FollowupDrawerProps) {
  const queryClient = useQueryClient();
  const [followupData, setFollowupData] = useState({
    notes: '',
    outcome: '',
    next_followup_date: '',
  });

  const createFollowupMutation = useMutation({
    mutationFn: () => leadService.createFollowup({
      lead_id: lead?.id,
      followup_date: new Date().toISOString(),
      ...followupData,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups', lead?.id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onOpenChange(false);
      setFollowupData({ notes: '', outcome: '', next_followup_date: '' });
      toast.success('Follow-up logged');
    },
    onError: () => toast.error('Failed to log follow-up'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Log Follow-up</SheetTitle>
          <SheetDescription>
            {lead ? `Recording follow-up for ${lead.full_name}` : 'Record a follow-up interaction'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Outcome</Label>
            <Select value={followupData.outcome} onValueChange={(v) => setFollowupData({ ...followupData, outcome: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="called">Called - No Answer</SelectItem>
                <SelectItem value="spoke">Spoke - Interested</SelectItem>
                <SelectItem value="spoke_later">Spoke - Call Back Later</SelectItem>
                <SelectItem value="visited">Visited Gym</SelectItem>
                <SelectItem value="not_interested">Not Interested</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={followupData.notes}
              onChange={(e) => setFollowupData({ ...followupData, notes: e.target.value })}
              placeholder="Add notes about this follow-up..."
              rows={4}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Next Follow-up Date</Label>
            <Input
              type="date"
              value={followupData.next_followup_date}
              onChange={(e) => setFollowupData({ ...followupData, next_followup_date: e.target.value })}
            />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={() => createFollowupMutation.mutate()} 
            disabled={createFollowupMutation.isPending}
          >
            {createFollowupMutation.isPending ? 'Saving...' : 'Save Follow-up'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
