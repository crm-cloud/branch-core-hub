import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, IndianRupee } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface RecordPaymentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
  memberId?: string;
  branchId: string;
}

export function RecordPaymentDrawer({ 
  open, 
  onOpenChange, 
  invoice, 
  memberId,
  branchId 
}: RecordPaymentDrawerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const dueAmount = invoice ? (invoice.total_amount - (invoice.amount_paid || 0)) : 0;
  
  const [amount, setAmount] = useState(dueAmount);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      if (amount > dueAmount) {
        throw new Error('Amount cannot exceed due amount');
      }

      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          branch_id: branchId,
          member_id: memberId || invoice?.member_id || null,
          invoice_id: invoice?.id,
          amount,
          payment_method: paymentMethod as any,
          status: 'completed',
          payment_date: new Date().toISOString(),
          transaction_id: transactionId || null,
          notes: notes || null,
          received_by: user?.id,
        });

      if (paymentError) throw paymentError;

      // Update invoice
      if (invoice) {
        const newPaidAmount = (invoice.amount_paid || 0) + amount;
        const newStatus = newPaidAmount >= invoice.total_amount ? 'paid' : 'partial';

        const { error: invoiceError } = await supabase
          .from('invoices')
          .update({
            amount_paid: newPaidAmount,
            status: newStatus,
          })
          .eq('id', invoice.id);

        if (invoiceError) throw invoiceError;
      }

      return { amount };
    },
    onSuccess: (data) => {
      toast.success(`Payment of ₹${data.amount.toLocaleString()} recorded`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-details'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-payments'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['member-payments'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to record payment');
    },
  });

  const resetForm = () => {
    setAmount(dueAmount);
    setPaymentMethod('cash');
    setTransactionId('');
    setNotes('');
  };

  // Reset amount when invoice changes
  useState(() => {
    setAmount(dueAmount);
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Record Payment
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Invoice Info */}
          {invoice && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4 space-y-1">
                <p className="font-mono text-sm">{invoice.invoice_number}</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span>₹{invoice.total_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid:</span>
                  <span className="text-success">₹{(invoice.amount_paid || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-medium border-t pt-1">
                  <span>Due:</span>
                  <span className="text-destructive">₹{dueAmount.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label>Amount (₹) *</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                max={dueAmount}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setAmount(dueAmount)}
                className="text-xs"
              >
                Full Amount
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setAmount(Math.round(dueAmount / 2))}
                className="text-xs"
              >
                Half
              </Button>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Payment Method *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="wallet">Wallet</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Transaction ID */}
          {paymentMethod !== 'cash' && (
            <div className="space-y-2">
              <Label>Transaction ID</Label>
              <Input
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Reference number"
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          {/* Summary */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Recording Payment</span>
                <span className="text-xl font-bold flex items-center text-primary">
                  <IndianRupee className="h-5 w-5" />
                  {amount.toLocaleString()}
                </span>
              </div>
              {amount < dueAmount && (
                <p className="text-sm text-muted-foreground mt-1">
                  Remaining due: ₹{(dueAmount - amount).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => recordPayment.mutate()} 
            disabled={amount <= 0 || amount > dueAmount || recordPayment.isPending}
          >
            {recordPayment.isPending ? 'Recording...' : 'Record Payment'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
