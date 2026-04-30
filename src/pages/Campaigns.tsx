import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Plus, MessageSquare, Mail, CheckCircle2, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { useBranchContext } from '@/contexts/BranchContext';
import { listCampaigns, type Campaign } from '@/services/campaignService';
import { CampaignWizard } from '@/components/campaigns/CampaignWizard';
import { format } from 'date-fns';

const channelIcon = (c: string) => c === 'email' ? Mail : MessageSquare;
const statusBadge = (s: string) => {
  switch (s) {
    case 'sent': return { c: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 };
    case 'sending': return { c: 'bg-blue-100 text-blue-700 border-blue-200', icon: Loader2 };
    case 'scheduled': return { c: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock };
    case 'failed': return { c: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle };
    default: return { c: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock };
  }
};

export default function Campaigns() {
  const { selectedBranch } = useBranchContext();
  const branchId = selectedBranch && selectedBranch !== 'all' ? selectedBranch : null;
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns', branchId],
    queryFn: () => listCampaigns(branchId!),
    enabled: !!branchId,
  });

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white shadow-lg shadow-violet-500/25">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
                <Megaphone className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Marketing & Campaigns</h1>
                <p className="text-violet-100 text-sm mt-0.5">Send targeted WhatsApp, Email, and SMS broadcasts to your members.</p>
              </div>
            </div>
            <Button
              onClick={() => setWizardOpen(true)}
              className="rounded-xl bg-white text-violet-700 hover:bg-violet-50 font-semibold"
              disabled={!branchId}
            >
              <Plus className="h-4 w-4" /> New Campaign
            </Button>
          </div>
        </div>

        {!branchId && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-amber-800 text-sm">
            Select a specific branch from the top-bar selector to view and create campaigns.
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-600" /></div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-2xl bg-card border border-dashed border-border p-12 text-center">
            <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold text-foreground">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Create your first marketing campaign to engage with members.</p>
            <Button onClick={() => setWizardOpen(true)} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white mt-4" disabled={!branchId}>
              <Plus className="h-4 w-4" /> New Campaign
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaigns.map((c: Campaign) => {
              const Icon = channelIcon(c.channel);
              const sb = statusBadge(c.status);
              const Sicon = sb.icon;
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
                    {c.sent_at ? `Sent ${format(new Date(c.sent_at), 'dd MMM, HH:mm')}` : `Created ${format(new Date(c.created_at), 'dd MMM, HH:mm')}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {branchId && (
        <CampaignWizard open={wizardOpen} onOpenChange={setWizardOpen} branchId={branchId} />
      )}
    </AppLayout>
  );
}
