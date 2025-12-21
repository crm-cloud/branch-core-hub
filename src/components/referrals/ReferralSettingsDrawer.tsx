import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ReferralSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  settings?: any;
}

export function ReferralSettingsDrawer({ open, onOpenChange, branchId, settings }: ReferralSettingsDrawerProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    is_enabled: true,
    referrer_reward_amount: 500,
    referred_reward_amount: 200,
    min_membership_value: 1000,
    reward_type: 'wallet_credit',
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        is_enabled: settings.is_enabled ?? true,
        referrer_reward_amount: settings.referrer_reward_amount ?? 500,
        referred_reward_amount: settings.referred_reward_amount ?? 200,
        min_membership_value: settings.min_membership_value ?? 1000,
        reward_type: settings.reward_type ?? 'wallet_credit',
      });
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) {
      toast.error('Please select a branch');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        branch_id: branchId,
        ...formData,
      };

      if (settings?.id) {
        const { error } = await supabase
          .from('referral_settings')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('referral_settings')
          .upsert(payload, { onConflict: 'branch_id' });
        if (error) throw error;
      }

      toast.success('Referral settings saved');
      queryClient.invalidateQueries({ queryKey: ['referral-settings'] });
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving referral settings:', error);
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Referral Program Settings</SheetTitle>
          <SheetDescription>Configure rewards for referrers and referred members</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <Label htmlFor="is_enabled" className="text-base">Enable Referral Program</Label>
              <p className="text-sm text-muted-foreground">Allow members to refer new members</p>
            </div>
            <Switch
              id="is_enabled"
              checked={formData.is_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, is_enabled: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="referrer_reward">Referrer Reward Amount (₹)</Label>
            <Input
              id="referrer_reward"
              type="number"
              min={0}
              value={formData.referrer_reward_amount}
              onChange={(e) => setFormData({ ...formData, referrer_reward_amount: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">Amount credited to the member who refers</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="referred_reward">Referred Member Reward Amount (₹)</Label>
            <Input
              id="referred_reward"
              type="number"
              min={0}
              value={formData.referred_reward_amount}
              onChange={(e) => setFormData({ ...formData, referred_reward_amount: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">Amount credited to the new member who was referred</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min_membership">Minimum Membership Value (₹)</Label>
            <Input
              id="min_membership"
              type="number"
              min={0}
              value={formData.min_membership_value}
              onChange={(e) => setFormData({ ...formData, min_membership_value: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">Minimum plan value for referral to qualify</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reward_type">Reward Type</Label>
            <Select
              value={formData.reward_type}
              onValueChange={(v) => setFormData({ ...formData, reward_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wallet_credit">Wallet Credit</SelectItem>
                <SelectItem value="discount">Discount on Renewal</SelectItem>
                <SelectItem value="free_days">Free Membership Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Settings'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
