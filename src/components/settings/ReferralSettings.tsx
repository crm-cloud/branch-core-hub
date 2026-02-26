import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Gift, Save, Percent, IndianRupee } from 'lucide-react';
import { useBranchContext } from '@/contexts/BranchContext';

export function ReferralSettings() {
  const queryClient = useQueryClient();
  const { effectiveBranchId } = useBranchContext();
  const selectedBranch = effectiveBranchId || '';
  const [formData, setFormData] = useState({
    is_active: true,
    reward_mode: 'fixed',
    referrer_reward_value: 500,
    referred_reward_value: 200,
    min_membership_value: 1000,
    referrer_reward_type: 'wallet_credit',
    referred_reward_type: 'wallet_credit',
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ['referral-settings', selectedBranch],
    queryFn: async () => {
      if (!selectedBranch) return null;
      const { data, error } = await supabase
        .from('referral_settings')
        .select('*')
        .eq('branch_id', selectedBranch)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!selectedBranch,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        is_active: settings.is_active ?? true,
        reward_mode: settings.reward_mode ?? 'fixed',
        referrer_reward_value: settings.referrer_reward_value ?? 500,
        referred_reward_value: settings.referred_reward_value ?? 200,
        min_membership_value: settings.min_membership_value ?? 1000,
        referrer_reward_type: settings.referrer_reward_type ?? 'wallet_credit',
        referred_reward_type: settings.referred_reward_type ?? 'wallet_credit',
      });
    } else {
      setFormData({
        is_active: true,
        reward_mode: 'fixed',
        referrer_reward_value: 500,
        referred_reward_value: 200,
        min_membership_value: 1000,
        referrer_reward_type: 'wallet_credit',
        referred_reward_type: 'wallet_credit',
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBranch) throw new Error('Please select a branch');
      
      const payload = {
        branch_id: selectedBranch,
        ...formData,
      };

      const { error } = await supabase
        .from('referral_settings')
        .upsert(payload, { onConflict: 'branch_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Referral settings saved');
      queryClient.invalidateQueries({ queryKey: ['referral-settings'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save settings');
    },
  });

  // Calculate preview amounts
  const previewMembershipValue = 5000;
  const previewReferrerReward = formData.reward_mode === 'percentage' 
    ? (previewMembershipValue * formData.referrer_reward_value / 100)
    : formData.referrer_reward_value;
  const previewReferredReward = formData.reward_mode === 'percentage'
    ? (previewMembershipValue * formData.referred_reward_value / 100)
    : formData.referred_reward_value;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Gift className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Referral Program Settings</CardTitle>
              <CardDescription>Configure rewards for members who refer new members</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {selectedBranch && (
            <>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <Label htmlFor="is_active" className="text-base">Enable Referral Program</Label>
                  <p className="text-sm text-muted-foreground">Allow members to refer new members and earn rewards</p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              {/* Reward Mode Selection */}
              <div className="space-y-3">
                <Label className="text-base">Reward Calculation Mode</Label>
                <RadioGroup
                  value={formData.reward_mode}
                  onValueChange={(v) => setFormData({ ...formData, reward_mode: v })}
                  className="grid grid-cols-2 gap-4"
                >
                  <div className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    formData.reward_mode === 'fixed' ? 'border-primary bg-primary/5' : 'border-muted'
                  }`}>
                    <RadioGroupItem value="fixed" id="fixed" />
                    <Label htmlFor="fixed" className="flex items-center gap-2 cursor-pointer">
                      <IndianRupee className="h-4 w-4" />
                      <div>
                        <p className="font-medium">Fixed Amount</p>
                        <p className="text-xs text-muted-foreground">Same reward regardless of plan value</p>
                      </div>
                    </Label>
                  </div>
                  <div className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    formData.reward_mode === 'percentage' ? 'border-primary bg-primary/5' : 'border-muted'
                  }`}>
                    <RadioGroupItem value="percentage" id="percentage" />
                    <Label htmlFor="percentage" className="flex items-center gap-2 cursor-pointer">
                      <Percent className="h-4 w-4" />
                      <div>
                        <p className="font-medium">Percentage</p>
                        <p className="text-xs text-muted-foreground">% of membership value</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="referrer_reward">
                    Referrer Reward {formData.reward_mode === 'percentage' ? '(%)' : '(₹)'}
                  </Label>
                  <Input
                    id="referrer_reward"
                    type="number"
                    min={0}
                    max={formData.reward_mode === 'percentage' ? 100 : undefined}
                    value={formData.referrer_reward_value}
                    onChange={(e) => setFormData({ ...formData, referrer_reward_value: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.reward_mode === 'percentage' 
                      ? 'Percentage of membership value for referrer'
                      : 'Amount credited to the member who refers'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="referred_reward">
                    Referred Member Reward {formData.reward_mode === 'percentage' ? '(%)' : '(₹)'}
                  </Label>
                  <Input
                    id="referred_reward"
                    type="number"
                    min={0}
                    max={formData.reward_mode === 'percentage' ? 100 : undefined}
                    value={formData.referred_reward_value}
                    onChange={(e) => setFormData({ ...formData, referred_reward_value: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.reward_mode === 'percentage'
                      ? 'Percentage discount for new member'
                      : 'Amount credited to the new member'}
                  </p>
                </div>
              </div>

              {/* Preview Box */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm font-medium mb-2">Reward Preview (for ₹{previewMembershipValue.toLocaleString()} membership)</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Referrer gets:</p>
                    <p className="text-lg font-bold text-primary">₹{previewReferrerReward.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">New member gets:</p>
                    <p className="text-lg font-bold text-primary">₹{previewReferredReward.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
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
                    value={formData.referrer_reward_type}
                    onValueChange={(v) => setFormData({ ...formData, referrer_reward_type: v, referred_reward_type: v })}
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
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
