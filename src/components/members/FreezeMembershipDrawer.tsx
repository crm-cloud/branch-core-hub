import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays, addDays } from 'date-fns';
import { Pause, Calendar, AlertCircle, IndianRupee } from 'lucide-react';

interface FreezeMembershipDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membership: any;
  memberName: string;
}

export function FreezeMembershipDrawer({
  open,
  onOpenChange,
  membership,
  memberName,
}: FreezeMembershipDrawerProps) {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('');

  // Get branch settings for freeze fee
  const { data: branchSettings } = useQuery({
    queryKey: ['branch-settings', membership?.branch_id],
    queryFn: async () => {
      if (!membership?.branch_id) return null;
      const { data, error } = await supabase
        .from('branch_settings')
        .select('*')
        .eq('branch_id', membership.branch_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!membership?.branch_id,
  });

  // Get plan max freeze days
  const maxFreezeDays = membership?.membership_plans?.max_freeze_days || 30;
  const usedFreezeDays = membership?.total_freeze_days_used || 0;
  const remainingFreezeDays = maxFreezeDays - usedFreezeDays;

  const freezeDays = differenceInDays(new Date(endDate), new Date(startDate)) + 1;
  const freezeFee = branchSettings?.freeze_fee || 0;

  const freezeMutation = useMutation({
    mutationFn: async () => {
      if (freezeDays > remainingFreezeDays) {
        throw new Error(`Cannot freeze for more than ${remainingFreezeDays} days`);
      }
      if (freezeDays <= 0) {
        throw new Error('End date must be after start date');
      }

      // Create freeze history record
      const { data: freezeRecord, error: freezeError } = await supabase
        .from('membership_freeze_history')
        .insert({
          membership_id: membership.id,
          start_date: startDate,
          end_date: endDate,
          days_frozen: freezeDays,
          reason,
          fee_charged: freezeFee,
          status: 'pending',
        })
        .select()
        .single();

      if (freezeError) throw freezeError;

      // Create approval request
      const { error: approvalError } = await supabase
        .from('approval_requests')
        .insert({
          branch_id: membership.branch_id,
          approval_type: 'membership_freeze' as const,
          reference_type: 'membership_freeze',
          reference_id: freezeRecord.id,
          request_data: {
            membershipId: membership.id,
            memberName,
            startDate,
            endDate,
            daysFrozen: freezeDays,
            reason,
            feeCharged: freezeFee,
          },
        });

      if (approvalError) throw approvalError;

      return freezeRecord;
    },
    onSuccess: () => {
      toast.success('Freeze request submitted for approval');
      queryClient.invalidateQueries({ queryKey: ['member-details'] });
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to submit freeze request');
    },
  });

  const resetForm = () => {
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setEndDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
    setReason('');
  };

  if (!membership) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Pause className="h-5 w-5" />
            Freeze Membership
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Member & Plan Info */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <p className="font-medium">{memberName}</p>
              <p className="text-sm text-muted-foreground">
                {membership.membership_plans?.name} • Ends: {format(new Date(membership.end_date), 'dd MMM yyyy')}
              </p>
            </CardContent>
          </Card>

          {/* Freeze Allowance */}
          <Card className={remainingFreezeDays <= 0 ? 'border-destructive/50 bg-destructive/5' : ''}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Freeze Days Remaining</p>
                  <p className="text-sm text-muted-foreground">Max {maxFreezeDays} days per membership</p>
                </div>
                <div className={`text-2xl font-bold ${remainingFreezeDays <= 0 ? 'text-destructive' : 'text-primary'}`}>
                  {remainingFreezeDays}
                </div>
              </div>
            </CardContent>
          </Card>

          {remainingFreezeDays <= 0 ? (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="pt-4 flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p className="font-medium">No freeze days remaining</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Date Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Start Date
                  </Label>
                  <Input
                    type="date"
                    value={startDate}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> End Date
                  </Label>
                  <Input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>Reason for Freeze</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Medical leave, travel, etc."
                  rows={3}
                />
              </div>

              {/* Summary */}
              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Freeze Duration</span>
                    <span className={freezeDays > remainingFreezeDays ? 'text-destructive' : ''}>
                      {freezeDays} days
                    </span>
                  </div>
                  {freezeFee > 0 && (
                    <div className="flex justify-between">
                      <span>Freeze Fee</span>
                      <span className="flex items-center">
                        <IndianRupee className="h-3 w-3" />
                        {freezeFee}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-muted-foreground border-t pt-2">
                    <span>New End Date (after approval)</span>
                    <span>{format(addDays(new Date(membership.end_date), freezeDays), 'dd MMM yyyy')}</span>
                  </div>
                </CardContent>
              </Card>

              {freezeDays > remainingFreezeDays && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  Exceeds remaining freeze days
                </p>
              )}
            </>
          )}
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => freezeMutation.mutate()}
            disabled={
              remainingFreezeDays <= 0 ||
              freezeDays > remainingFreezeDays ||
              freezeDays <= 0 ||
              freezeMutation.isPending
            }
          >
            {freezeMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
