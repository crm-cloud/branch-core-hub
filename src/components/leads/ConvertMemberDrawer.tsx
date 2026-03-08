import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leadService } from '@/services/leadService';
import { useBranches } from '@/hooks/useBranches';
import { toast } from 'sonner';
import { UserPlus, Phone, Mail, ArrowRight, Building2 } from 'lucide-react';

interface ConvertMemberDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: any | null;
}

export function ConvertMemberDrawer({ open, onOpenChange, lead }: ConvertMemberDrawerProps) {
  const queryClient = useQueryClient();
  const { data: branches = [] } = useBranches();
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Pre-select the lead's branch if available
  const effectiveBranchId = selectedBranchId || lead?.branch_id || '';

  const convertMutation = useMutation({
    mutationFn: () => {
      if (!effectiveBranchId) throw new Error('Please select a branch');
      return leadService.convertToMember(lead?.id, effectiveBranchId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      onOpenChange(false);
      setSelectedBranchId('');
      toast.success('Lead converted to member!');
    },
    onError: (err: any) => toast.error(err?.message || 'Conversion failed'),
  });

  if (!lead) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Convert to Member</SheetTitle>
          <SheetDescription>
            Convert this lead into an active member
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserPlus className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{lead.full_name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {lead.phone}
                  </div>
                  {lead.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {lead.email}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Source</span>
                  <Badge variant="outline">{lead.source || 'Direct'}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Status</span>
                  <Badge className="bg-warning/10 text-warning">{lead.status}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Branch Selector */}
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <Building2 className="h-5 w-5 text-primary" />
                <Label className="font-medium">Select Branch *</Label>
              </div>
              <Select
                value={effectiveBranchId}
                onValueChange={setSelectedBranchId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a branch for this member" />
                </SelectTrigger>
                <SelectContent>
                  {(branches || []).filter((b: any) => b.is_active).map((branch: any) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                The member will be registered at the selected branch
              </p>
            </CardContent>
          </Card>

          <Card className="bg-success/5 border-success/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <ArrowRight className="h-5 w-5 text-success" />
                <div>
                  <h4 className="font-medium">What happens next?</h4>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                    <li>• A login account will be created for the member</li>
                    <li>• A new member profile will be created at the selected branch</li>
                    <li>• Lead status will be marked as converted</li>
                    <li>• You can then assign a membership plan</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={() => convertMutation.mutate()} 
            disabled={convertMutation.isPending || !effectiveBranchId}
            className="bg-success hover:bg-success/90"
          >
            {convertMutation.isPending ? 'Converting...' : 'Convert to Member'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}