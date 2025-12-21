import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, differenceInDays } from 'date-fns';
import { Play, Calendar, CheckCircle } from 'lucide-react';

interface UnfreezeMembershipDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membership: any;
  memberName: string;
}

export function UnfreezeMembershipDrawer({
  open,
  onOpenChange,
  membership,
  memberName,
}: UnfreezeMembershipDrawerProps) {
  const queryClient = useQueryClient();

  const unfreezeMutation = useMutation({
    mutationFn: async () => {
      // Get approved freeze records
      const { data: freezeHistory, error: historyError } = await supabase
        .from('membership_freeze_history')
        .select('*')
        .eq('membership_id', membership.id)
        .eq('status', 'approved');

      if (historyError) throw historyError;

      // Calculate total frozen days
      const totalFrozenDays = freezeHistory?.reduce((sum, f) => sum + f.days_frozen, 0) || 0;
      
      // Calculate new end date
      const originalEnd = new Date(membership.original_end_date);
      const newEndDate = format(addDays(originalEnd, totalFrozenDays), 'yyyy-MM-dd');

      // Update membership status
      const { error: updateError } = await supabase
        .from('memberships')
        .update({
          status: 'active',
          end_date: newEndDate,
          total_freeze_days_used: totalFrozenDays,
        })
        .eq('id', membership.id);

      if (updateError) throw updateError;

      return { newEndDate, totalFrozenDays };
    },
    onSuccess: (data) => {
      toast.success(`Membership resumed. New end date: ${format(new Date(data.newEndDate), 'dd MMM yyyy')}`);
      queryClient.invalidateQueries({ queryKey: ['member-details'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to unfreeze membership');
    },
  });

  if (!membership) return null;

  const daysRemaining = differenceInDays(new Date(membership.end_date), new Date());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Resume Membership
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Member Info */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <p className="font-medium">{memberName}</p>
              <p className="text-sm text-muted-foreground">
                {membership.membership_plans?.name}
              </p>
            </CardContent>
          </Card>

          {/* Current Status */}
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2 text-warning">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">Currently Frozen</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Original End Date: {format(new Date(membership.original_end_date), 'dd MMM yyyy')}
              </p>
              <p className="text-sm text-muted-foreground">
                Current End Date: {format(new Date(membership.end_date), 'dd MMM yyyy')}
              </p>
              <p className="text-sm text-muted-foreground">
                Frozen Days Used: {membership.total_freeze_days_used || 0}
              </p>
            </CardContent>
          </Card>

          {/* What happens */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Membership will be reactivated</p>
                  <p className="text-xs text-muted-foreground">
                    Status will change from "frozen" to "active"
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                <div>
                  <p className="font-medium text-sm">End date adjusted for freeze period</p>
                  <p className="text-xs text-muted-foreground">
                    Days frozen will be added to your membership
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => unfreezeMutation.mutate()}
            disabled={unfreezeMutation.isPending}
          >
            {unfreezeMutation.isPending ? 'Resuming...' : 'Resume Membership'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
