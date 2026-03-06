import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Snowflake, Calendar, AlertTriangle, IndianRupee } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

interface QuickFreezeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: { id: string; member_code: string; profiles?: { full_name: string } };
  activeMembership: { id: string; end_date: string; branch_id?: string; member_id?: string; membership_plans?: { name: string } };
  onSuccess: () => void;
}

export function QuickFreezeDrawer({ open, onOpenChange, member, activeMembership, onSuccess }: QuickFreezeDrawerProps) {
  const { user } = useAuth();
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaidFreeze, setIsPaidFreeze] = useState(false);
  const [freezeFee, setFreezeFee] = useState(0);

  const startDate = new Date();
  const endDate = addDays(startDate, days);
  const newMembershipEndDate = addDays(new Date(activeMembership.end_date), days);

  const handleFreeze = async () => {
    if (days < 1 || days > 90) { toast.error('Freeze duration must be between 1 and 90 days'); return; }

    setIsSubmitting(true);
    try {
      const { data: freezeRecord, error: freezeError } = await supabase.from('membership_freeze_history').insert({
        membership_id: activeMembership.id,
        start_date: format(startDate, 'yyyy-MM-dd'), end_date: format(endDate, 'yyyy-MM-dd'),
        reason: reason || 'Staff initiated quick freeze', days_frozen: days,
        fee_charged: isPaidFreeze ? freezeFee : 0,
        status: 'approved', approved_by: user?.id, approved_at: new Date().toISOString(),
      }).select().single();
      if (freezeError) throw freezeError;

      const { error: membershipError } = await supabase.from('memberships').update({
        status: 'frozen', end_date: format(newMembershipEndDate, 'yyyy-MM-dd'),
      }).eq('id', activeMembership.id);
      if (membershipError) throw membershipError;

      // Generate freeze fee invoice if paid
      if (isPaidFreeze && freezeFee > 0 && (activeMembership as any).branch_id && (activeMembership as any).member_id) {
        const invoicePayload = {
          branch_id: (activeMembership as any).branch_id,
          member_id: (activeMembership as any).member_id,
          total_amount: freezeFee,
          subtotal: freezeFee,
          status: 'pending' as const,
          due_date: format(startDate, 'yyyy-MM-dd'),
        };
        const { data: invoice } = await supabase
          .from('invoices')
          .insert([invoicePayload])
          .select()
          .single();
        if (invoice) {
          await supabase.from('invoice_items').insert({
            invoice_id: invoice.id, description: 'Membership Freeze Fee',
            unit_price: freezeFee, quantity: 1, total_amount: freezeFee,
            reference_type: 'freeze_fee', reference_id: freezeRecord?.id || '',
          });
        }
      }

      toast.success('Membership frozen successfully');
      onSuccess();
      onOpenChange(false);
      setDays(7); setReason(''); setIsPaidFreeze(false); setFreezeFee(0);
    } catch (error: any) {
      toast.error(error.message || 'Failed to freeze membership');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Snowflake className="h-5 w-5 text-info" />Quick Freeze Membership</SheetTitle>
          <SheetDescription>This will immediately freeze the membership without requiring approval.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-6">
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-sm font-medium">{member.profiles?.full_name || 'Member'}</p>
            <p className="text-xs text-muted-foreground font-mono">{member.member_code}</p>
            <p className="text-xs text-muted-foreground">Plan: {activeMembership.membership_plans?.name || 'Active Plan'}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="days">Freeze Duration (Days)</Label>
            <Input id="days" type="number" min={1} max={90} value={days} onChange={(e) => setDays(parseInt(e.target.value) || 1)} />
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Freeze Start</span>
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{format(startDate, 'dd MMM yyyy')}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Freeze End</span>
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{format(endDate, 'dd MMM yyyy')}</span>
            </div>
            <div className="flex items-center justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">New Expiry Date</span>
              <span className="font-medium text-success">{format(newMembershipEndDate, 'dd MMM yyyy')}</span>
            </div>
          </div>

          {/* Paid Freeze */}
          <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/30">
            <div><Label>Paid Freeze</Label><p className="text-xs text-muted-foreground">Charge a fee</p></div>
            <Switch checked={isPaidFreeze} onCheckedChange={setIsPaidFreeze} />
          </div>

          {isPaidFreeze && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><IndianRupee className="h-4 w-4" /> Freeze Fee</Label>
              <Input type="number" min={0} value={freezeFee} onChange={(e) => setFreezeFee(parseFloat(e.target.value) || 0)} />
              <p className="text-xs text-muted-foreground">An invoice will be generated</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea id="reason" placeholder="Enter reason for freeze..." value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/20 p-3">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-warning">This action bypasses the approval queue and takes effect immediately.</p>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleFreeze} disabled={isSubmitting}>{isSubmitting ? 'Freezing...' : 'Freeze Now'}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
