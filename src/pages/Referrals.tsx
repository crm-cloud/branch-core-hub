import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gift, Users, Wallet, Copy, Check, Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { toast } from 'sonner';
import { claimReward } from '@/services/referralService';

export default function ReferralsPage() {
  const { user } = useAuth();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [createReferralOpen, setCreateReferralOpen] = useState(false);
  const [newReferral, setNewReferral] = useState({ referrerMemberId: '', referredName: '', referredPhone: '', referredEmail: '' });
  const queryClient = useQueryClient();

  // Fetch members for referrer selection
  const { data: members = [] } = useQuery({
    queryKey: ['referral-members'],
    enabled: !!user,
    queryFn: async (): Promise<any[]> => {
      const { data, error } = await (supabase as any)
        .from('members')
        .select('id, member_code, user_id')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      // Fetch profiles separately
      const userIds = (data || []).map(m => m.user_id).filter(Boolean);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return (data || []).map(m => ({ ...m, profiles: profileMap.get(m.user_id) || null }));
    },
  });

  const createReferralMutation = useMutation({
    mutationFn: async () => {
      const member = members.find((m: any) => m.id === newReferral.referrerMemberId);
      if (!member) throw new Error('Select a referrer member');
      const code = `REF-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from('referrals').insert({
        referrer_member_id: newReferral.referrerMemberId,
        referral_code: code,
        referred_name: newReferral.referredName || 'Unknown',
        referred_phone: newReferral.referredPhone || 'N/A',
        status: 'new' as const,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Referral created');
      queryClient.invalidateQueries({ queryKey: ['all-referrals'] });
      setCreateReferralOpen(false);
      setNewReferral({ referrerMemberId: '', referredName: '', referredPhone: '', referredEmail: '' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: referrals = [], isLoading: referralsLoading } = useQuery({
    queryKey: ['all-referrals'],
    enabled: !!user,
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
    enabled: !!user,
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
          <Button onClick={() => setCreateReferralOpen(true)} className="bg-accent hover:bg-accent/90">
            <Plus className="mr-2 h-4 w-4" />
            Create Referral
          </Button>
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

      {/* Create Referral Drawer */}
      <Sheet open={createReferralOpen} onOpenChange={setCreateReferralOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Create Referral</SheetTitle>
            <SheetDescription>Manually log a referral from a walk-in or phone inquiry</SheetDescription>
          </SheetHeader>
          <form onSubmit={(e) => { e.preventDefault(); createReferralMutation.mutate(); }} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Referrer Member *</Label>
              <Select value={newReferral.referrerMemberId} onValueChange={(v) => setNewReferral({ ...newReferral, referrerMemberId: v })}>
                <SelectTrigger><SelectValue placeholder="Select member who referred" /></SelectTrigger>
                <SelectContent>
                  {members.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.profiles?.full_name || m.member_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Referred Person Name</Label>
              <Input value={newReferral.referredName} onChange={(e) => setNewReferral({ ...newReferral, referredName: e.target.value })} placeholder="Name of the referred person" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={newReferral.referredPhone} onChange={(e) => setNewReferral({ ...newReferral, referredPhone: e.target.value })} placeholder="Phone number" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={newReferral.referredEmail} onChange={(e) => setNewReferral({ ...newReferral, referredEmail: e.target.value })} placeholder="Email address" />
            </div>
            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setCreateReferralOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createReferralMutation.isPending || !newReferral.referrerMemberId}>
                {createReferralMutation.isPending ? 'Creating...' : 'Create Referral'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
