import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Gift, Save } from 'lucide-react';

export function ReferralSettings() {
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [formData, setFormData] = useState({
    is_active: true,
    referrer_reward_value: 500,
    referred_reward_value: 200,
    min_membership_value: 1000,
    referrer_reward_type: 'wallet_credit',
    referred_reward_type: 'wallet_credit',
  });

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('id, name');
      if (error) throw error;
      return data || [];
    },
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
        referrer_reward_value: settings.referrer_reward_value ?? 500,
        referred_reward_value: settings.referred_reward_value ?? 200,
        min_membership_value: settings.min_membership_value ?? 1000,
        referrer_reward_type: settings.referrer_reward_type ?? 'wallet_credit',
        referred_reward_type: settings.referred_reward_type ?? 'wallet_credit',
      });
    } else {
      setFormData({
        is_active: true,
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
          <div className="max-w-xs">
            <Label>Select Branch</Label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch: any) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="referrer_reward">Referrer Reward Amount (₹)</Label>
                  <Input
                    id="referrer_reward"
                    type="number"
                    min={0}
                    value={formData.referrer_reward_value}
                    onChange={(e) => setFormData({ ...formData, referrer_reward_value: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">Amount credited to the member who refers</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="referred_reward">Referred Member Reward (₹)</Label>
                  <Input
                    id="referred_reward"
                    type="number"
                    min={0}
                    value={formData.referred_reward_value}
                    onChange={(e) => setFormData({ ...formData, referred_reward_value: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">Amount credited to the new member</p>
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
