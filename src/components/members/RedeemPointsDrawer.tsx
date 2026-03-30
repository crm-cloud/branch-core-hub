import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Award, Gift, Snowflake, ShoppingBag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface RedeemPointsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
  branchId: string;
  currentPoints: number;
}

const REDEEM_OPTIONS = [
  { label: '1 Free Freeze Month', points: 500, icon: Snowflake, type: 'freeze_month' },
  { label: 'Merchandise Credit ₹200', points: 200, icon: ShoppingBag, type: 'merchandise' },
  { label: 'Free PT Session', points: 300, icon: Gift, type: 'pt_session' },
];

export function RedeemPointsDrawer({ open, onOpenChange, memberId, memberName, branchId, currentPoints }: RedeemPointsDrawerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [customPoints, setCustomPoints] = useState('');
  const [customReason, setCustomReason] = useState('');

  const redeemMutation = useMutation({
    mutationFn: async ({ points, reason }: { points: number; reason: string }) => {
      if (points > currentPoints) throw new Error('Insufficient points');
      if (points <= 0) throw new Error('Points must be positive');

      // Insert negative ledger entry
      const { error: ledgerError } = await supabase
        .from('rewards_ledger' as any)
        .insert({
          member_id: memberId,
          branch_id: branchId,
          points: -points,
          reason: `Redeemed: ${reason}`,
          reference_type: 'redemption',
          created_by: user?.id,
        });
      if (ledgerError) throw ledgerError;

      // Update member reward_points
      const { error: updateError } = await supabase
        .from('members')
        .update({ reward_points: currentPoints - points })
        .eq('id', memberId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Points redeemed successfully');
      queryClient.invalidateQueries({ queryKey: ['rewards-ledger', memberId] });
      queryClient.invalidateQueries({ queryKey: ['member-details'] });
      setCustomPoints('');
      setCustomReason('');
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to redeem points');
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Redeem Points — {memberName}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="text-center p-4 rounded-xl bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground">Available Balance</p>
            <p className="text-3xl font-bold text-primary">{currentPoints}</p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Quick Redeem</Label>
            {REDEEM_OPTIONS.map((opt) => (
              <Card key={opt.type} className={`cursor-pointer transition-all hover:border-primary/30 ${opt.points > currentPoints ? 'opacity-50' : ''}`}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <opt.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.points} points</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={opt.points > currentPoints || redeemMutation.isPending}
                    onClick={() => redeemMutation.mutate({ points: opt.points, reason: opt.label })}
                  >
                    Redeem
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-semibold">Custom Redemption</Label>
            <div className="space-y-2">
              <Input
                type="number"
                placeholder="Points to redeem"
                value={customPoints}
                onChange={(e) => setCustomPoints(e.target.value)}
                min={1}
                max={currentPoints}
              />
              <Textarea
                placeholder="Reason for redemption..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button
            className="w-full"
            disabled={!customPoints || !customReason || redeemMutation.isPending}
            onClick={() => redeemMutation.mutate({ points: parseInt(customPoints), reason: customReason })}
          >
            {redeemMutation.isPending ? 'Redeeming...' : `Redeem ${customPoints || 0} Points`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
