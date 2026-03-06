import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';

const ACTIONS = [
  { value: 'called', label: '📞 Called' },
  { value: 'whatsapp', label: '💬 WhatsApp' },
  { value: 'visited', label: '🏃 Visited' },
  { value: 'email', label: '📧 Email' },
  { value: 'other', label: '📝 Other' },
];

interface RecordFollowUpDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  referenceType: string;
  referenceId: string;
  referenceName?: string;
}

export function RecordFollowUpDrawer({
  open, onOpenChange, branchId, referenceType, referenceId, referenceName,
}: RecordFollowUpDrawerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [actionTaken, setActionTaken] = useState('called');
  const [notes, setNotes] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!actionTaken) { toast.error('Select an action'); return; }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('follow_up_activities').insert({
        branch_id: branchId, reference_type: referenceType, reference_id: referenceId,
        action_taken: actionTaken, notes: notes || null,
        next_follow_up_date: nextDate || null, created_by: user?.id,
      });
      if (error) throw error;

      // Update lead follow_up_date if applicable
      if (referenceType === 'lead' && nextDate) {
        await supabase.from('leads').update({ notes: `Next follow-up: ${nextDate}` } as any).eq('id', referenceId);
      }

      toast.success('Follow-up recorded');
      queryClient.invalidateQueries({ queryKey: ['followup-activities'] });
      queryClient.invalidateQueries({ queryKey: ['followup-leads'] });
      onOpenChange(false);
      setActionTaken('called'); setNotes(''); setNextDate('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to record follow-up');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-accent" /> Record Follow-Up
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {referenceName && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm font-medium">{referenceName}</p>
              <p className="text-xs text-muted-foreground capitalize">{referenceType}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Action Taken *</Label>
            <Select value={actionTaken} onValueChange={setActionTaken}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => (<SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was discussed..." rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Next Follow-Up Date</Label>
            <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]} />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Record'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
