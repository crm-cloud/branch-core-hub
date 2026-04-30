import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Plus, MessageSquare, Mail, CheckCircle2, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { useBranchContext } from '@/contexts/BranchContext';
import { listCampaigns, type Campaign } from '@/services/campaignService';
import { CampaignWizard } from '@/components/campaigns/CampaignWizard';
import { format, formatDistanceToNow } from 'date-fns';

const channelIcon = (c: string) => (c === 'email' ? Mail : MessageSquare);
const statusBadge = (s: string) => {
  switch (s) {
    case 'sent': return { c: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 };
    case 'sending': return { c: 'bg-blue-100 text-blue-700 border-blue-200', icon: Loader2 };
    case 'scheduled': return { c: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock };
    case 'failed': return { c: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle };
    default: return { c: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock };
  }
};

export function CampaignsPanel() {
  const { selectedBranch } = useBranchContext();
  const branchId = selectedBranch && selectedBranch !== 'all' ? selectedBranch : null;
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns', branchId],
    queryFn: () => listCampaigns(branchId!),
    enabled: !!branchId,
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Marketing & Campaigns</h2>
          <p className="text-sm text-muted-foreground">Send targeted WhatsApp, Email, and SMS broadcasts to your members.</p>
        </div>
        <Button
          onClick={() => setWizardOpen(true)}
          className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white gap-2"
          disabled={!branchId}
        >
          <Plus className="h-4 w-4" /> New Campaign
        </Button>
      </div>

      {!branchId && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-amber-800 text-sm">
          Select a specific branch from the top-bar selector to view and create campaigns.
        </div>
      )}

      {branchId && isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-600" /></div>
      ) : branchId && campaigns.length === 0 ? (
        <div className="rounded-2xl bg-card border border-dashed border-border p-12 text-center">
          <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold text-foreground">No campaigns yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create your first marketing campaign to engage with members.</p>
        </div>
      ) : branchId && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {campaigns.map((c: Campaign) => {
            const Icon = channelIcon(c.channel);
            const sb = statusBadge(c.status);
            const Sicon = sb.icon;
            const isScheduled = c.status === 'scheduled' && c.scheduled_at;
            return (
              <div key={c.id} className="rounded-2xl bg-card p-5 shadow-md shadow-slate-200/50 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-500/20 text-violet-600 flex items-center justify-center">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground line-clamp-1">{c.name}</h3>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{c.channel}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`${sb.c} rounded-full text-[10px] uppercase`}>
                    <Sicon className={`h-3 w-3 mr-1 ${c.status === 'sending' ? 'animate-spin' : ''}`} /> {c.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{c.message}</p>
                {isScheduled && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 mb-3 text-xs text-amber-800 flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Sends {formatDistanceToNow(new Date(c.scheduled_at!), { addSuffix: true })}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t">
                  <div>
                    <p className="text-lg font-bold text-foreground">{c.recipients_count}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Sent to</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-600">{c.success_count}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Delivered</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-600">{c.failure_count}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Failed</p>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground text-center mt-3">
                  {c.sent_at
                    ? `Sent ${format(new Date(c.sent_at), 'dd MMM, HH:mm')}`
                    : `Created ${format(new Date(c.created_at), 'dd MMM, HH:mm')}`}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {branchId && (
        <CampaignWizard open={wizardOpen} onOpenChange={setWizardOpen} branchId={branchId} />
      )}
    </div>
  );
}
