import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, addDays, differenceInDays } from 'date-fns';
import { usePlans } from '@/hooks/usePlans';
import { CreditCard, IndianRupee, Calendar, User, Gift, AlertTriangle, CheckCircle } from 'lucide-react';

interface PurchaseMembershipDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
  branchId: string;
}

export function PurchaseMembershipDrawer({ 
  open, 
  onOpenChange, 
  memberId, 
  memberName,
  branchId 
}: PurchaseMembershipDrawerProps) {
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const queryClient = useQueryClient();

  const { data: plans = [] } = usePlans(branchId);
  const selectedPlan = plans.find((p: any) => p.id === selectedPlanId);

  // Check if member has active membership
  const { data: activeMembership } = useQuery({
    queryKey: ['active-membership-check', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('*, membership_plans(name)')
        .eq('member_id', memberId)
        .eq('status', 'active')
        .gte('end_date', format(new Date(), 'yyyy-MM-dd'))
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!memberId && open,
  });

  // Calculate if renewal is allowed (only 7 days before expiry or after expiry)
  const daysUntilExpiry = activeMembership 
    ? differenceInDays(new Date(activeMembership.end_date), new Date())
    : null;
  
  const canRenew = !activeMembership || (daysUntilExpiry !== null && daysUntilExpiry <= 7);

  // Check if member has a pending referral
  const { data: pendingReferral } = useQuery({
    queryKey: ['pending-referral', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referrals')
        .select('*, referrer:referrer_member_id(id, member_code, user_id)')
        .eq('referred_member_id', memberId)
        .eq('status', 'new')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!memberId,
  });

  // Get referral settings
  const { data: referralSettings } = useQuery({
    queryKey: ['referral-settings', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referral_settings')
        .select('*')
        .eq('is_active', true)
        .or(`branch_id.eq.${branchId},branch_id.is.null`)
        .order('branch_id', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const calculateTotal = () => {
    if (!selectedPlan) return 0;
    const base = selectedPlan.discounted_price || selectedPlan.price;
    const admission = selectedPlan.admission_fee || 0;
    return base + admission - discountAmount;
  };

  const calculateEndDate = () => {
    if (!selectedPlan) return '';
    return format(addDays(new Date(startDate), selectedPlan.duration_days), 'yyyy-MM-dd');
  };

  const purchaseMembership = useMutation({
    mutationFn: async () => {
      if (!selectedPlan) throw new Error('Please select a plan');

      const endDate = calculateEndDate();
      const pricePaid = calculateTotal();

      // Create membership
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .insert({
          member_id: memberId,
          plan_id: selectedPlanId,
          branch_id: branchId,
          start_date: startDate,
          end_date: endDate,
          original_end_date: endDate,
          price_paid: pricePaid,
          discount_amount: discountAmount,
          discount_reason: discountReason || null,
          status: 'active',
        })
        .select()
        .single();

      if (membershipError) throw membershipError;

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          branch_id: branchId,
          member_id: memberId,
          invoice_number: '', // Will be auto-generated
          subtotal: (selectedPlan.discounted_price || selectedPlan.price) + (selectedPlan.admission_fee || 0),
          discount_amount: discountAmount,
          tax_amount: 0,
          total_amount: pricePaid,
          status: 'paid',
          due_date: startDate,
          amount_paid: pricePaid,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      const items: any[] = [
        {
          invoice_id: invoice.id,
          description: `${selectedPlan.name} - ${selectedPlan.duration_days} days`,
          quantity: 1,
          unit_price: selectedPlan.discounted_price || selectedPlan.price,
          total_amount: selectedPlan.discounted_price || selectedPlan.price,
          reference_type: 'membership',
          reference_id: membership.id,
        },
      ];

      if (selectedPlan.admission_fee > 0) {
        items.push({
          invoice_id: invoice.id,
          description: 'Admission Fee',
          quantity: 1,
          unit_price: selectedPlan.admission_fee,
          total_amount: selectedPlan.admission_fee,
          reference_type: 'admission_fee',
          reference_id: membership.id,
        });
      }

      await supabase.from('invoice_items').insert(items);

      // Record payment
      await supabase.from('payments').insert({
        branch_id: branchId,
        member_id: memberId,
        invoice_id: invoice.id,
        amount: pricePaid,
        payment_method: paymentMethod as any,
        status: 'completed',
        payment_date: new Date().toISOString(),
      });

      // Update member status to active
      await supabase
        .from('members')
        .update({ status: 'active' })
        .eq('id', memberId);

      // Process referral rewards if applicable
      if (pendingReferral && referralSettings && pricePaid >= (referralSettings.min_membership_value || 0)) {
        // Update referral status to converted
        await supabase
          .from('referrals')
          .update({ 
            status: 'converted' as const, 
            converted_at: new Date().toISOString() 
          })
          .eq('id', pendingReferral.id);

        // Create reward for referrer
        if (referralSettings.referrer_reward_value > 0) {
          await supabase.from('referral_rewards').insert({
            referral_id: pendingReferral.id,
            member_id: pendingReferral.referrer_member_id,
            reward_type: referralSettings.referrer_reward_type,
            reward_value: referralSettings.referrer_reward_value,
            description: `Referral bonus for referring ${memberName}`,
            is_claimed: false,
          });
        }

        // Create reward for referred member (optional)
        if (referralSettings.referred_reward_value > 0) {
          await supabase.from('referral_rewards').insert({
            referral_id: pendingReferral.id,
            member_id: memberId,
            reward_type: referralSettings.referred_reward_type,
            reward_value: referralSettings.referred_reward_value,
            description: `Welcome bonus for joining via referral`,
            is_claimed: false,
          });
        }

        toast.success('Referral rewards created!');
      }

      return { membership, invoice };
    },
    onSuccess: () => {
      toast.success('Membership purchased successfully');
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
      queryClient.invalidateQueries({ queryKey: ['all-rewards'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to purchase membership');
    },
  });

  const resetForm = () => {
    setSelectedPlanId('');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setDiscountAmount(0);
    setDiscountReason('');
    setPaymentMethod('cash');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Purchase Membership
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Active Membership Warning */}
          {activeMembership && !canRenew && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Member already has an active membership ({activeMembership.membership_plans?.name}) 
                expiring on {format(new Date(activeMembership.end_date), 'dd MMM yyyy')}. 
                Renewal is allowed only 7 days before expiry.
                <br />
                <span className="font-medium">Days remaining: {daysUntilExpiry}</span>
              </AlertDescription>
            </Alert>
          )}

          {/* Renewal Notice */}
          {activeMembership && canRenew && (
            <Alert className="border-success/50 bg-success/5">
              <CheckCircle className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                Current membership expires in {daysUntilExpiry} days. 
                New membership will start after current one ends.
              </AlertDescription>
            </Alert>
          )}

          {/* Member Info */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{memberName}</p>
                  <p className="text-sm text-muted-foreground">Member ID: {memberId.slice(0, 8)}...</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plan Selection */}
          <div className="space-y-2">
            <Label>Select Plan *</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a membership plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan: any) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    <div className="flex justify-between items-center w-full">
                      <span>{plan.name}</span>
                      <span className="text-muted-foreground ml-2">
                        ₹{plan.discounted_price || plan.price} / {plan.duration_days} days
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Referral Bonus Indicator */}
          {pendingReferral && referralSettings && (
            <Card className="border-green-500/50 bg-green-500/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-green-600">
                  <Gift className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Referral Bonus Active!</p>
                    <p className="text-sm text-muted-foreground">
                      Referrer gets ₹{referralSettings.referrer_reward_value} • 
                      New member gets ₹{referralSettings.referred_reward_value}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedPlan && (
            <>
              {/* Plan Details */}
              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Plan Price</span>
                    <span>₹{selectedPlan.discounted_price || selectedPlan.price}</span>
                  </div>
                  {selectedPlan.admission_fee > 0 && (
                    <div className="flex justify-between">
                      <span>Admission Fee</span>
                      <span>₹{selectedPlan.admission_fee}</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Discount</span>
                      <span>-₹{discountAmount}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>Total</span>
                    <span className="flex items-center">
                      <IndianRupee className="h-4 w-4" />
                      {calculateTotal()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Start Date */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Start Date
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  End Date: {calculateEndDate()}
                </p>
              </div>

              {/* Discount */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discount Amount</Label>
                  <Input
                    type="number"
                    min={0}
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discount Reason</Label>
                  <Input
                    placeholder="e.g., Referral, Promo"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label>Payment Method</Label>
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
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              className="flex-1" 
              onClick={() => purchaseMembership.mutate()}
              disabled={!selectedPlanId || purchaseMembership.isPending || !canRenew}
            >
              {purchaseMembership.isPending ? 'Processing...' : canRenew ? 'Complete Purchase' : 'Cannot Purchase Yet'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
