import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, IndianRupee } from 'lucide-react';

interface TopUpBenefitDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  membershipId: string;
  branchId: string;
  benefitName: string;
  benefitTypeId: string;
  benefitType: string;
}

export function TopUpBenefitDrawer({
  open,
  onOpenChange,
  memberId,
  membershipId,
  branchId,
  benefitName,
  benefitTypeId,
  benefitType,
}: TopUpBenefitDrawerProps) {
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(5);
  const [price, setPrice] = useState(500);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (quantity <= 0 || price < 0) {
      toast.error('Please enter valid quantity and price');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Add benefit_usage credits (negative usage_count to represent credits)
      // We add to plan_benefits limit_count by inserting a top-up record
      // For simplicity, we record negative usage to offset existing usage
      for (let i = 0; i < quantity; i++) {
        await supabase.from('benefit_usage').insert({
          membership_id: membershipId,
          benefit_type: benefitType as any,
          benefit_type_id: benefitTypeId,
          usage_date: new Date().toISOString().split('T')[0],
          usage_count: -1, // negative = credit/top-up
          notes: `Top-up: +1 ${benefitName} session`,
        });
      }

      // 2. Generate an invoice for the top-up
      if (price > 0) {
        const { data: invoice, error: invError } = await supabase
          .from('invoices')
          .insert([{
            branch_id: branchId,
            member_id: memberId,
            subtotal: price,
            total_amount: price,
            tax_amount: 0,
            discount_amount: 0,
            amount_paid: 0,
            status: 'pending' as const,
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            notes: `Top-up: ${quantity}x ${benefitName} sessions`,
          }])
          .select('id')
          .single();

        if (invError) throw invError;

        // Add invoice item
        if (invoice) {
          await supabase.from('invoice_items').insert({
            invoice_id: invoice.id,
            description: `${benefitName} Top-Up (${quantity} sessions)`,
            quantity: quantity,
            unit_price: price / quantity,
            total_amount: price,
          });
        }
      }

      toast.success(`Added ${quantity} ${benefitName} sessions`);
      queryClient.invalidateQueries({ queryKey: ['member-benefit-usage-summary'] });
      queryClient.invalidateQueries({ queryKey: ['member-plan-benefits'] });
      queryClient.invalidateQueries({ queryKey: ['member-payments'] });
      onOpenChange(false);
      setQuantity(5);
      setPrice(500);
    } catch (err: any) {
      toast.error(err.message || 'Failed to top up benefit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Top Up: {benefitName}
          </SheetTitle>
          <SheetDescription>
            Add extra sessions and generate an invoice
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label>Number of Sessions</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label>Total Price (₹)</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              ₹{quantity > 0 ? Math.round(price / quantity) : 0} per session
            </p>
          </div>

          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Sessions to add</span>
              <span className="font-medium">+{quantity}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Invoice amount</span>
              <span className="font-medium">₹{price.toLocaleString()}</span>
            </div>
          </div>

          <Button
            className="w-full"
            disabled={submitting || quantity <= 0}
            onClick={handleSubmit}
          >
            {submitting ? 'Processing...' : `Add ${quantity} Sessions & Generate Invoice`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
