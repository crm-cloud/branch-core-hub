import { useState } from 'react';
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

  if (!membership) return null;

  const totalDays = differenceInDays(
    new Date(membership.end_date),
    new Date(membership.start_date)
  );
  const daysUsed = differenceInDays(new Date(), new Date(membership.start_date));
  const daysRemaining = Math.max(0, totalDays - daysUsed);
  const dailyRate = membership.price_paid / totalDays;

  const calculateRefund = () => {
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

      // Update membership status
      const { error: membershipError } = await supabase
        .from('memberships')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id,
          cancellation_reason: cancellationReason,
          refund_amount: refundAmount,
        })
        .eq('id', membership.id);

      if (membershipError) throw membershipError;

      // If there's a refund, create a refund invoice
      if (refundAmount > 0) {
        // Find original invoice
        const { data: originalInvoice } = await supabase
          .from('invoices')
          .select('id, invoice_number')
          .eq('member_id', membership.member_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Create refund invoice (negative amount)
        const { data: refundInvoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            branch_id: membership.branch_id,
            member_id: membership.member_id,
            invoice_number: '', // Auto-generated
            subtotal: -refundAmount,
            total_amount: -refundAmount,
            status: 'refunded',
            notes: `Refund for cancelled membership. Original invoice: ${originalInvoice?.invoice_number || 'N/A'}. Reason: ${cancellationReason}`,
            refund_amount: refundAmount,
            refund_reason: cancellationReason,
            refunded_at: new Date().toISOString(),
            refunded_by: user?.id,
          })
          .select()
          .single();

        if (invoiceError) throw invoiceError;

        // Create refund invoice item
        await supabase.from('invoice_items').insert({
          invoice_id: refundInvoice.id,
          description: `Refund - ${membership.membership_plans?.name || 'Membership'} (${daysRemaining} days remaining)`,
          quantity: 1,
          unit_price: -refundAmount,
          total_amount: -refundAmount,
          reference_type: 'membership_refund',
          reference_id: membership.id,
        });

        // Record refund payment
        await supabase.from('payments').insert({
          branch_id: membership.branch_id,
          member_id: membership.member_id,
          invoice_id: refundInvoice.id,
          amount: -refundAmount,
          payment_method: refundMethod as any,
          status: 'completed',
          payment_date: new Date().toISOString(),
        });
      }

      // Check if member has any other active memberships
      const { data: otherMemberships } = await supabase
        .from('memberships')
        .select('id')
        .eq('member_id', membership.member_id)
        .eq('status', 'active')
        .neq('id', membership.id)
        .limit(1);

      // If no other active memberships, update member status
      if (!otherMemberships || otherMemberships.length === 0) {
        await supabase
          .from('members')
          .update({ status: 'inactive' })
          .eq('id', membership.member_id);
      }

      return { refundAmount };
    },
    onSuccess: (data) => {
      toast.success(
        data.refundAmount > 0
          ? `Membership cancelled. Refund of ₹${data.refundAmount} processed.`
          : 'Membership cancelled successfully'
      );
      queryClient.invalidateQueries({ queryKey: ['members'] });
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
