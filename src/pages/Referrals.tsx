import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gift, Users, Wallet, Copy, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { toast } from 'sonner';
import { claimReward } from '@/services/referralService';

export default function ReferralsPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: referrals = [], isLoading: referralsLoading } = useQuery({
    queryKey: ['all-referrals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referrals')
        .select(`
          *,
          referrer:referrer_member_id(member_code, user_id, profiles:user_id(full_name)),
          referred:referred_member_id(member_code, user_id, profiles:user_id(full_name))
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: rewards = [], isLoading: rewardsLoading } = useQuery({
    queryKey: ['all-rewards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referral_rewards')
        .select(`
          *,
          members(member_code, profiles:user_id(full_name)),
          referrals(referral_code)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const claimMutation = useMutation({
    mutationFn: ({ rewardId, memberId }: { rewardId: string; memberId: string }) =>
      claimReward(rewardId, memberId),
    onSuccess: () => {
      toast.success('Reward claimed and credited to wallet!');
      queryClient.invalidateQueries({ queryKey: ['all-rewards'] });
    },
    onError: (error) => {
      toast.error('Failed to claim reward: ' + error.message);
    },
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Referral code copied!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const stats = {
    total: referrals.length,
    converted: referrals.filter((r: any) => r.status === 'converted').length,
    pending: referrals.filter((r: any) => r.status === 'pending').length,
    totalRewards: rewards.reduce((sum: number, r: any) => sum + (r.reward_value || 0), 0),
    claimedRewards: rewards.filter((r: any) => r.is_claimed).reduce((sum: number, r: any) => sum + (r.reward_value || 0), 0),
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Referrals & Rewards</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Referrals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Converted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.converted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Rewards</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">₹{stats.totalRewards.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">₹{stats.claimedRewards.toLocaleString()} claimed</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="referrals">
          <TabsList>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
          </TabsList>

          <TabsContent value="referrals" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>All Referrals</CardTitle>
              </CardHeader>
              <CardContent>
                {referralsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Referrer</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Referred</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referrals.map((referral: any) => (
                        <TableRow key={referral.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              {referral.referrer?.profiles?.full_name || referral.referrer?.member_code}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="bg-muted px-2 py-1 rounded text-sm">{referral.referral_code}</code>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => copyCode(referral.referral_code)}
                              >
                                {copiedCode === referral.referral_code ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            {referral.referred?.profiles?.full_name || referral.referred?.member_code || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={referral.status === 'converted' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}>
                              {referral.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(referral.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                      {referrals.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            <Gift className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            No referrals yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rewards" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Reward History</CardTitle>
              </CardHeader>
              <CardContent>
                {rewardsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Reward Type</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rewards.map((reward: any) => (
                        <TableRow key={reward.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Wallet className="h-4 w-4 text-muted-foreground" />
                              {reward.members?.profiles?.full_name || reward.members?.member_code}
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">{reward.reward_type.replace('_', ' ')}</TableCell>
                          <TableCell className="font-medium">₹{reward.reward_value || 0}</TableCell>
                          <TableCell>
                            <Badge className={reward.is_claimed ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}>
                              {reward.is_claimed ? 'Claimed' : 'Pending'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {!reward.is_claimed && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => claimMutation.mutate({ rewardId: reward.id, memberId: reward.member_id })}
                                disabled={claimMutation.isPending}
                              >
                                Claim
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {rewards.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            <Gift className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            No rewards yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
