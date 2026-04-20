import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, addDays, differenceInDays } from 'date-fns';
import { usePlans } from '@/hooks/usePlans';
import { CreditCard, IndianRupee, Calendar, User, Gift, AlertTriangle, CheckCircle, Lock, Wallet } from 'lucide-react';
import { useGstRates } from '@/hooks/useGstRates';

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
  const [selectedLockerId, setSelectedLockerId] = useState<string>('');
  
  // GST State
  const [includeGst, setIncludeGst] = useState(false);
  const [gstRate, setGstRate] = useState(18);
  
  // Partial Payment State
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [amountPaying, setAmountPaying] = useState(0);
  const [paymentDueDate, setPaymentDueDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [sendReminders, setSendReminders] = useState(true);
  
  const queryClient = useQueryClient();
  const { data: gstRates = [5, 12, 18, 28] } = useGstRates();

  const { data: plans = [] } = usePlans(branchId);
  const selectedPlan = plans.find((p: any) => p.id === selectedPlanId);

  // Check if selected plan has locker benefit
  const hasLockerBenefit = selectedPlan?.plan_benefits?.some(
    (b: any) => b.benefit_type === 'locker_access' || b.benefit_type?.includes('locker')
  );

  // Fetch available lockers
  const { data: availableLockers = [] } = useQuery({
    queryKey: ['available-lockers', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lockers')
        .select('*')
        .eq('branch_id', branchId)
        .eq('status', 'available')
        .order('locker_number');
      if (error) throw error;
      return data || [];
    },
    enabled: !!branchId && hasLockerBenefit,
  });

  // Check if member has active membership
  const { data: activeMembership } = useQuery({
    queryKey: ['active-membership-check', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('*, membership_plans(name)')
        .eq('member_id', memberId)
        .in('status', ['active', 'frozen'])
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

  const calculateGstAmount = () => {
    if (!includeGst || !selectedPlan) return 0;
    const base = (selectedPlan.discounted_price || selectedPlan.price) + (selectedPlan.admission_fee || 0) - discountAmount;
    return Math.round(base * (gstRate / 100));
  };

  const calculateTotal = () => {
    if (!selectedPlan) return 0;
    const base = selectedPlan.discounted_price || selectedPlan.price;
    const admission = selectedPlan.admission_fee || 0;
    return base + admission - discountAmount + calculateGstAmount();
  };

  const calculateEndDate = () => {
    if (!selectedPlan) return '';
    return format(addDays(new Date(startDate), selectedPlan.duration_days), 'yyyy-MM-dd');
  };

  const remainingAmount = calculateTotal() - amountPaying;

  const purchaseMembership = useMutation({
    mutationFn: async () => {
      if (!selectedPlan) throw new Error('Please select a plan');

      const isPaymentLink = paymentMethod === 'razorpay_link';

      // Validate partial payment
      if (isPartialPayment && !isPaymentLink) {
        if (amountPaying <= 0) throw new Error('Please enter amount paying now');
        if (amountPaying >= calculateTotal()) throw new Error('Amount paying should be less than total for partial payment');
        if (!paymentDueDate) throw new Error('Please set a due date for remaining amount');
      }

      // ✅ Renewal: if member has an active membership, start the new one the day after current expiry.
      const effectiveStartDate = activeMembership && canRenew && activeMembership.end_date
        ? format(addDays(new Date(activeMembership.end_date), 1), 'yyyy-MM-dd')
        : startDate;

      // Recompute end date from the effective start date so the duration is honoured.
      const computedEndDate = format(
        addDays(new Date(effectiveStartDate), selectedPlan.duration_days - 1),
        'yyyy-MM-dd'
      );

      const totalAmount = calculateTotal();
      const actualAmountPaid = isPaymentLink ? 0 : (isPartialPayment ? amountPaying : totalAmount);

      // 1. Create membership
      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .insert({
          member_id: memberId,
          plan_id: selectedPlanId,
          branch_id: branchId,
          start_date: effectiveStartDate,
          end_date: computedEndDate,
          original_end_date: computedEndDate,
          price_paid: totalAmount,
          discount_amount: discountAmount,
          discount_reason: discountReason || null,
          status: isPaymentLink ? 'pending' : 'active',
        })
        .select()
        .single();

      if (membershipError) throw membershipError;

      // Determine invoice status
      const invoiceStatus = isPaymentLink ? 'pending' : (isPartialPayment ? 'partial' : 'paid');

      // 2. Create invoice — let the DB trigger (generate_invoice_number) assign the number.
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          branch_id: branchId,
          member_id: memberId,
          subtotal: (selectedPlan.discounted_price || selectedPlan.price) + (selectedPlan.admission_fee || 0),
          discount_amount: discountAmount,
          tax_amount: calculateGstAmount(),
          total_amount: totalAmount,
          status: invoiceStatus as any,
          due_date: isPartialPayment ? paymentDueDate : effectiveStartDate,
          // amount_paid will be set by record_payment RPC; keep 0 here for the manual-payment path
          amount_paid: isPaymentLink ? 0 : 0,
          payment_due_date: isPartialPayment ? paymentDueDate : null,
          is_gst_invoice: includeGst,
          gst_rate: includeGst ? gstRate : 0,
        })
        .select()
        .single();

      if (invoiceError) {
        // Rollback orphan membership
        await supabase.from('memberships').delete().eq('id', membership.id);
        throw invoiceError;
      }

      // 3. Create invoice items
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

      const { error: itemsError } = await supabase.from('invoice_items').insert(items);
      if (itemsError) {
        await supabase.from('invoices').delete().eq('id', invoice.id);
        await supabase.from('memberships').delete().eq('id', membership.id);
        throw itemsError;
      }

      // 4. Record payment or generate payment link
      if (isPaymentLink) {
        const { data: linkData, error: linkError } = await supabase.functions.invoke('create-razorpay-link', {
          body: { invoiceId: invoice.id, amount: totalAmount, branchId },
        });
        if (linkError) throw new Error(linkError.message || 'Failed to generate payment link');
        if (linkData?.error) throw new Error(linkData.error);

        if (linkData?.short_url) {
          await navigator.clipboard.writeText(linkData.short_url);
          toast.success(`Payment link copied: ${linkData.short_url}`);
        }
      } else if (actualAmountPaid > 0) {
        // ✅ Use unified record_payment RPC — handles invoice status, audit, wallet, membership activation atomically.
        const { data: payRes, error: payErr } = await supabase.rpc('record_payment', {
          p_branch_id: branchId,
          p_invoice_id: invoice.id,
          p_member_id: memberId,
          p_amount: actualAmountPaid,
          p_payment_method: paymentMethod as any,
          p_transaction_id: null,
          p_notes: null,
          p_received_by: null,
          p_income_category_id: null,
        });
        if (payErr) throw payErr;
        const payResult = payRes as any;
        if (payResult && payResult.success === false) {
          throw new Error(payResult.error || 'Payment failed');
        }
      }

      // 5. Create payment reminders if partial payment and reminders enabled
      if (isPartialPayment && sendReminders && remainingAmount > 0) {
        const dueDate = new Date(paymentDueDate);
        const reminderDates = [
          { date: addDays(dueDate, -3), type: 'due_soon' },
          { date: dueDate, type: 'on_due' },
          { date: addDays(dueDate, 3), type: 'overdue' },
        ].filter(r => r.date > new Date());

        for (const reminder of reminderDates) {
          await supabase.from('payment_reminders').insert({
            branch_id: branchId,
            invoice_id: invoice.id,
            member_id: memberId,
            reminder_type: reminder.type,
            scheduled_for: reminder.date.toISOString(),
            status: 'pending',
          });
        }
      }

      // 6. Update member status to active
      await supabase
        .from('members')
        .update({ status: 'active' })
        .eq('id', memberId);

      // Process referral rewards if applicable
      if (pendingReferral && referralSettings && totalAmount >= (referralSettings.min_membership_value || 0)) {
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

      // Auto-assign locker if plan has locker benefit and locker was selected
      if (hasLockerBenefit && selectedLockerId) {
        const endDate = calculateEndDate();
        
        // Create locker assignment
        await supabase.from('locker_assignments').insert({
          locker_id: selectedLockerId,
          member_id: memberId,
          start_date: startDate,
          end_date: endDate,
          fee_amount: 0, // Free as part of plan
          is_active: true,
        });

        // Update locker status to assigned
        await supabase
          .from('lockers')
          .update({ status: 'assigned' })
          .eq('id', selectedLockerId);
        
        toast.success('Complimentary locker assigned!');
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
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['available-lockers'] });
      queryClient.invalidateQueries({ queryKey: ['member-details'] });
      queryClient.invalidateQueries({ queryKey: ['member-memberships'] });
      queryClient.invalidateQueries({ queryKey: ['active-membership'] });
      queryClient.invalidateQueries({ queryKey: ['member-pending-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['member-pt-packages'] });
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
    setSelectedLockerId('');
    setIncludeGst(false);
    setGstRate(18);
    setIsPartialPayment(false);
    setAmountPaying(0);
    setPaymentDueDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
    setSendReminders(true);
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
                  {includeGst && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>CGST ({gstRate / 2}%)</span>
                        <span>₹{(calculateGstAmount() / 2).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>SGST ({gstRate / 2}%)</span>
                        <span>₹{(calculateGstAmount() / 2).toLocaleString()}</span>
                      </div>
                    </>
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

              {/* GST Toggle */}
              <Card className="border-dashed">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <Label htmlFor="gst-toggle" className="cursor-pointer">GST Invoice</Label>
                      <p className="text-xs text-muted-foreground">Enable to generate a tax invoice</p>
                    </div>
                    <Switch
                      id="gst-toggle"
                      checked={includeGst}
                      onCheckedChange={setIncludeGst}
                    />
                  </div>
                  {includeGst && (
                    <div className="space-y-2">
                      <Label>GST Rate</Label>
                      <Select value={gstRate.toString()} onValueChange={(v) => setGstRate(Number(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {gstRates.map((rate: number) => (
                            <SelectItem key={rate} value={rate.toString()}>{rate}%</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
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

              {/* Complimentary Locker Selection (if plan includes locker benefit) */}
              {hasLockerBenefit && (
                <Card className="border-primary/50 bg-primary/5">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Lock className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-primary">Complimentary Locker</p>
                        <p className="text-xs text-muted-foreground">This plan includes a free locker</p>
                      </div>
                    </div>
                    <Select value={selectedLockerId || "none"} onValueChange={(val) => setSelectedLockerId(val === "none" ? "" : val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a locker (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No locker needed</SelectItem>
                        {availableLockers.map((locker: any) => (
                          <SelectItem key={locker.id} value={locker.id}>
                            🔐 {locker.locker_number} {locker.size ? `(${locker.size})` : ''}
                          </SelectItem>
                        ))}
                        {availableLockers.length === 0 && (
                          <SelectItem value="no-lockers" disabled>
                            No lockers available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              )}

              {/* Partial Payment Toggle */}
              <Card className="border-dashed">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-primary" />
                      <div>
                        <Label htmlFor="partial-payment" className="cursor-pointer">Partial Payment</Label>
                        <p className="text-xs text-muted-foreground">Record partial payment with due date</p>
                      </div>
                    </div>
                    <Switch
                      id="partial-payment"
                      checked={isPartialPayment}
                      onCheckedChange={(checked) => {
                        setIsPartialPayment(checked);
                        if (checked) {
                          setAmountPaying(Math.round(calculateTotal() * 0.5)); // Default to 50%
                        }
                      }}
                    />
                  </div>

                  {isPartialPayment && (
                    <div className="space-y-4 pt-2 border-t">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Amount Paying Now *</Label>
                          <Input
                            type="number"
                            min={1}
                            max={calculateTotal() - 1}
                            value={amountPaying}
                            onChange={(e) => setAmountPaying(Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Due Date for Remaining *</Label>
                          <Input
                            type="date"
                            value={paymentDueDate}
                            min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                            onChange={(e) => setPaymentDueDate(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                        <div className="flex justify-between text-sm">
                          <span>Remaining Amount:</span>
                          <span className="font-bold text-warning">₹{remainingAmount}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Due on {format(new Date(paymentDueDate), 'dd MMM yyyy')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          id="send-reminders"
                          checked={sendReminders}
                          onCheckedChange={setSendReminders}
                        />
                        <Label htmlFor="send-reminders" className="text-sm cursor-pointer">
                          Send payment reminders (3 days before, on due date, 3 days after)
                        </Label>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

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
                    <SelectItem value="razorpay_link">🔗 Send Payment Link</SelectItem>
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
