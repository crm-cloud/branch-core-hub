import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Award, Plus, ArrowUp, ArrowDown, Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { RedeemPointsDrawer } from './RedeemPointsDrawer';

interface RewardsWalletCardProps {
  memberId: string;
  memberName: string;
  branchId: string;
  rewardPoints: number;
}

export function RewardsWalletCard({ memberId, memberName, branchId, rewardPoints }: RewardsWalletCardProps) {
  const [redeemOpen, setRedeemOpen] = useState(false);

  const { data: ledger = [] } = useQuery({
    queryKey: ['rewards-ledger', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rewards_ledger' as any)
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!memberId,
  });

  return (
    <>
      {/* Balance Card */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Reward Points</p>
                <p className="text-3xl font-bold text-primary">{rewardPoints || 0}</p>
              </div>
            </div>
            <Button size="sm" onClick={() => setRedeemOpen(true)} disabled={(rewardPoints || 0) <= 0}>
              <Gift className="h-4 w-4 mr-1.5" />
              Redeem
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Award className="h-4 w-4" />
            Points History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.length > 0 ? (
            <div className="space-y-2">
              {ledger.map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-full ${entry.points > 0 ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                      {entry.points > 0 ? (
                        <ArrowUp className="h-3 w-3 text-green-600" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{entry.reason}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(entry.created_at), 'dd MMM yyyy, hh:mm a')}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={entry.points > 0 ? 'text-green-600 border-green-500/20' : 'text-destructive border-destructive/20'}>
                    {entry.points > 0 ? '+' : ''}{entry.points}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No points history</p>
              <p className="text-xs mt-1">Points will appear here when earned</p>
            </div>
          )}
        </CardContent>
      </Card>

      <RedeemPointsDrawer
        open={redeemOpen}
        onOpenChange={setRedeemOpen}
        memberId={memberId}
        memberName={memberName}
        branchId={branchId}
        currentPoints={rewardPoints || 0}
      />
    </>
  );
}
