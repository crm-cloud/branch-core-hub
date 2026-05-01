import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Clock, Gift, Wallet, UserPlus } from 'lucide-react';
import { format } from 'date-fns';

export interface ReferralLifecycleRow {
  id: string;
  referred_name: string | null;
  referred_email: string | null;
  status: string;
  lifecycle_status?: string | null;
  created_at: string;
  converted_at?: string | null;
  rewarded_at?: string | null;
  claimed_at?: string | null;
  /** Joined reward (single, latest) — optional */
  reward?: {
    id: string;
    reward_value: number;
    is_claimed: boolean;
    claimed_at: string | null;
    claimed_wallet_txn_id: string | null;
  } | null;
}

const STAGES = [
  { key: 'pending', label: 'Pending', icon: Circle, ts: (r: ReferralLifecycleRow) => r.created_at },
  { key: 'eligible', label: 'Eligible', icon: UserPlus, ts: (r: ReferralLifecycleRow) => r.converted_at ?? null },
  { key: 'issued', label: 'Reward Issued', icon: Gift, ts: (r: ReferralLifecycleRow) => r.rewarded_at ?? r.reward?.claimed_at ?? null },
  { key: 'claimed', label: 'Claimed', icon: CheckCircle2, ts: (r: ReferralLifecycleRow) => r.claimed_at ?? r.reward?.claimed_at ?? null },
  { key: 'wallet_credited', label: 'Wallet Credited', icon: Wallet, ts: (r: ReferralLifecycleRow) => r.reward?.claimed_wallet_txn_id ? r.reward.claimed_at : null },
] as const;

function deriveStageReached(row: ReferralLifecycleRow): Record<string, boolean> {
  const reached: Record<string, boolean> = { pending: true };
  if (row.converted_at || row.status === 'converted') reached.eligible = true;
  if (row.rewarded_at || row.reward) reached.issued = true;
  if (row.reward?.is_claimed || row.claimed_at) reached.claimed = true;
  if (row.reward?.claimed_wallet_txn_id) reached.wallet_credited = true;
  return reached;
}

interface Props {
  referrals: ReferralLifecycleRow[];
}

export function ReferralLifecycleTimeline({ referrals }: Props) {
  if (referrals.length === 0) return null;

  return (
    <div className="space-y-4">
      {referrals.map((row) => {
        const reached = deriveStageReached(row);
        return (
          <Card key={row.id} className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                <div>
                  <div className="font-medium">
                    {row.referred_name || row.referred_email || 'Referred Member'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Started {format(new Date(row.created_at), 'dd MMM yyyy')}
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {row.lifecycle_status || row.status}
                </Badge>
              </div>

              <ol className="relative grid grid-cols-5 gap-1">
                {STAGES.map((stage, idx) => {
                  const Icon = stage.icon;
                  const isReached = reached[stage.key];
                  const ts = stage.ts(row);
                  const isLast = idx === STAGES.length - 1;
                  return (
                    <li key={stage.key} className="relative flex flex-col items-center text-center">
                      {!isLast && (
                        <span
                          aria-hidden
                          className={`absolute top-3.5 left-1/2 w-full h-0.5 ${
                            isReached && reached[STAGES[idx + 1].key]
                              ? 'bg-primary'
                              : 'bg-border'
                          }`}
                        />
                      )}
                      <span
                        className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                          isReached
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'bg-background border-border text-muted-foreground'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className={`mt-2 text-[11px] font-medium leading-tight ${
                        isReached ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {stage.label}
                      </span>
                      {ts ? (
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(ts), 'dd MMM')}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground mt-0.5 inline-flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          —
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
