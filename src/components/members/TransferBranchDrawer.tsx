import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, ArrowRight, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useBranchContext } from '@/contexts/BranchContext';

interface TransferBranchDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName?: string;
  currentBranchId: string;
  currentBranchName?: string;
}

export function TransferBranchDrawer({ open, onOpenChange, memberId, memberName, currentBranchId, currentBranchName }: TransferBranchDrawerProps) {
  const queryClient = useQueryClient();
  const { branches } = useBranchContext();
  const [targetBranchId, setTargetBranchId] = useState('');
  const [reason, setReason] = useState('');

  const availableBranches = (branches || []).filter((b: any) => b.id !== currentBranchId && b.is_active !== false);
  const targetBranch = availableBranches.find((b: any) => b.id === targetBranchId);

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!targetBranchId) throw new Error('Select a destination branch');
      if (!reason.trim()) throw new Error('Please provide a reason');

      // Update member's branch
      const { error: memberError } = await supabase
        .from('members')
        .update({ branch_id: targetBranchId })
        .eq('id', memberId);
      if (memberError) throw memberError;

      // Update active memberships to new branch
      const { error: msError } = await supabase
        .from('memberships')
        .update({ branch_id: targetBranchId })
        .eq('member_id', memberId)
        .in('status', ['active', 'frozen']);
      if (msError) throw msError;

      // Create audit log
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        action: 'BRANCH_TRANSFER',
        table_name: 'members',
        record_id: memberId,
        user_id: user?.id,
        branch_id: targetBranchId,
        old_data: { branch_id: currentBranchId, branch_name: currentBranchName },
        new_data: { branch_id: targetBranchId, branch_name: targetBranch?.name },
        action_description: `Transferred ${memberName || 'member'} from ${currentBranchName || 'old branch'} to ${targetBranch?.name || 'new branch'}. Reason: ${reason}`,
      });
    },
    onSuccess: () => {
      toast.success(`Member transferred to ${targetBranch?.name}`);
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member-details', memberId] });
      setTargetBranchId('');
      setReason('');
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Transfer Branch
          </SheetTitle>
          <SheetDescription>
            Move {memberName || 'member'} and their active memberships to another branch
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Current Branch */}
          <Card className="border-muted">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Current Branch</p>
                  <p className="font-semibold">{currentBranchName || 'Unknown'}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Destination</p>
                  <p className="font-semibold text-primary">{targetBranch?.name || '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label>Destination Branch *</Label>
            <Select value={targetBranchId} onValueChange={setTargetBranchId}>
              <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
              <SelectContent>
                {availableBranches.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Transfer Reason *</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Member relocated, requested transfer" />
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
            <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              This will move the member and all active/frozen memberships to the selected branch. Invoices and payment history will remain in the original branch.
            </p>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => transferMutation.mutate()} disabled={transferMutation.isPending || !targetBranchId || !reason.trim()}>
            {transferMutation.isPending ? 'Transferring...' : 'Transfer Member'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
