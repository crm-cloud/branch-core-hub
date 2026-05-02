import { useState } from 'react';
import { revokeHardwareAccess } from '@/services/membershipService';
import { cancelMembership as cancelMembershipRpc } from '@/services/membershipActionsService';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { differenceInDays, format } from 'date-fns';
import { XCircle, AlertTriangle, IndianRupee, Calculator } from 'lucide-react';
import { invalidateMembersData } from '@/lib/memberInvalidation';

interface CancelMembershipDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membership: any;
  memberName: string;
}

export function CancelMembershipDrawer({
  open,
  onOpenChange,
  membership,
  memberName,
}: CancelMembershipDrawerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [cancellationReason, setCancellationReason] = useState('');
  const [refundType, setRefundType] = useState<'full' | 'prorated' | 'none' | 'custom'>('prorated');
  const [customRefundAmount, setCustomRefundAmount] = useState(0);
  const [refundMethod, setRefundMethod] = useState('cash');

  const totalDays = membership ? differenceInDays(
    new Date(membership.end_date),
    new Date(membership.start_date)
  ) : 0;
  const daysUsed = membership ? differenceInDays(new Date(), new Date(membership.start_date)) : 0;
  const daysRemaining = Math.max(0, totalDays - daysUsed);
  const dailyRate = membership && totalDays > 0 ? membership.price_paid / totalDays : 0;

  const calculateRefund = () => {
    if (!membership) return 0;
    switch (refundType) {
      case 'full':
        return membership.price_paid;
      case 'prorated':
        return Math.round(dailyRate * daysRemaining);
      case 'custom':
        return customRefundAmount;
      case 'none':
      default:
        return 0;
    }
  };

  const refundAmount = calculateRefund();

  const cancelMembership = useMutation({
    mutationFn: async () => {
      if (!cancellationReason.trim()) {
        throw new Error('Please provide a cancellation reason');
      }
      // P4: route through atomic RPC — no more multi-step client writes.
      // Server handles status update, refund invoice/payment, member deactivation,
      // lifecycle audit, and idempotency in a single transaction.
      const result = await cancelMembershipRpc({
        membershipId: membership.id,
        reason: cancellationReason,
        refundAmount,
        refundMethod: refundMethod as 'cash' | 'card' | 'upi' | 'bank_transfer' | 'wallet',
        idempotencyKey: `cancel-${membership.id}-${cancellationReason.slice(0, 32)}`,
      });
      return { refundAmount: result.refund_amount };
    },
    onSuccess: (data) => {
      toast.success(
        data.refundAmount > 0
          ? `Membership cancelled. Refund of ₹${data.refundAmount} processed.`
          : 'Membership cancelled successfully'
      );
      // Revoke hardware access on cancel
      revokeHardwareAccess(membership.member_id, `Membership cancelled: ${cancellationReason}`, membership.branch_id);
      invalidateMembersData(queryClient);
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to cancel membership');
    },
  });

  if (!membership) return null;

  const resetForm = () => {
    setCancellationReason('');
    setRefundType('prorated');
    setCustomRefundAmount(0);
    setRefundMethod('cash');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Cancel Membership
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Warning */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This action will cancel the membership and cannot be undone.
            </AlertDescription>
          </Alert>

          {/* Member & Membership Info */}
          <Card>
            <CardContent className="pt-4 space-y-2">
              <p className="font-medium">{memberName}</p>
              <p className="text-sm text-muted-foreground">
                {membership.membership_plans?.name}
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Start:</span>{' '}
                  {format(new Date(membership.start_date), 'dd MMM yyyy')}
                </div>
                <div>
                  <span className="text-muted-foreground">End:</span>{' '}
                  {format(new Date(membership.end_date), 'dd MMM yyyy')}
                </div>
                <div>
                  <span className="text-muted-foreground">Paid:</span> ₹{membership.price_paid}
                </div>
                <div>
                  <span className="text-muted-foreground">Days Used:</span> {daysUsed}/{totalDays}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cancellation Reason */}
          <div className="space-y-2">
            <Label>Cancellation Reason *</Label>
            <Textarea
              placeholder="Why is the membership being cancelled?"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* Refund Calculation */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Refund Calculation
            </h3>

            <div className="space-y-2">
              <Label>Refund Type</Label>
              <Select value={refundType} onValueChange={(v: any) => setRefundType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prorated">
                    Prorated ({daysRemaining} days = ₹{Math.round(dailyRate * daysRemaining)})
                  </SelectItem>
                  <SelectItem value="full">Full Refund (₹{membership.price_paid})</SelectItem>
                  <SelectItem value="custom">Custom Amount</SelectItem>
                  <SelectItem value="none">No Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {refundType === 'custom' && (
              <div className="space-y-2">
                <Label>Custom Refund Amount</Label>
                <Input
                  type="number"
                  min={0}
                  max={membership.price_paid}
                  value={customRefundAmount}
                  onChange={(e) => setCustomRefundAmount(Number(e.target.value))}
                />
              </div>
            )}

            {refundAmount > 0 && (
              <div className="space-y-2">
                <Label>Refund Method</Label>
                <Select value={refundMethod} onValueChange={setRefundMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="wallet">Wallet Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Refund Summary */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Refund Amount:</span>
                  <span className="text-xl font-bold flex items-center">
                    <IndianRupee className="h-5 w-5" />
                    {refundAmount}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Keep Membership
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => cancelMembership.mutate()}
              disabled={cancelMembership.isPending || !cancellationReason.trim()}
            >
              {cancelMembership.isPending ? 'Processing...' : 'Cancel & Refund'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
