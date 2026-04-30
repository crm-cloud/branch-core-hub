import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronDown, ChevronRight, Search, MessageSquare, Mail, Phone, Bell,
  CheckCircle2, XCircle, Clock, Send, Eye, MessageSquareReply,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DeliveryTimeline } from './DeliveryTimeline';
import { KpiStrip, type KpiCounts } from './KpiStrip';

type ChannelKey = 'all' | 'whatsapp' | 'sms' | 'email' | 'in_app';

const channelMeta: Record<string, { icon: any; color: string; label: string }> = {
  whatsapp: { icon: MessageSquare, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10', label: 'WhatsApp' },
  sms: { icon: Phone, color: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10', label: 'SMS' },
  email: { icon: Mail, color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10', label: 'Email' },
  in_app: { icon: Bell, color: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10', label: 'In-App' },
};

const statusBadge = (s: string) => {
  const map: Record<string, { cls: string; icon: any; label: string }> = {
    sent: { cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30', icon: Send, label: 'Sent' },
    delivered: { cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', icon: CheckCircle2, label: 'Delivered' },
    read: { cls: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30', icon: Eye, label: 'Read' },
    replied: { cls: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30', icon: MessageSquareReply, label: 'Replied' },
    failed: { cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30', icon: XCircle, label: 'Failed' },
    bounced: { cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30', icon: XCircle, label: 'Bounced' },
    pending: { cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30', icon: Clock, label: 'Pending' },
    queued: { cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30', icon: Clock, label: 'Queued' },
  };
  const m = map[s] || { cls: 'bg-muted text-muted-foreground border-border', icon: Clock, label: s };
  const Icon = m.icon;
  return (
    <Badge variant="outline" className={cn('rounded-full gap-1 font-medium', m.cls)}>
      <Icon className="h-3 w-3" />{m.label}
    </Badge>
  );
};

const normalizeStatus = (log: any): string => {
  const status = (log.status || '').toLowerCase();
  const delivery = (log.delivery_status || '').toLowerCase();
  // Honour terminal statuses first — they are written by the dispatcher
  if (status === 'failed' || status === 'bounced') return status;
  // Honour delivery progressions (delivered/read/replied) when they exist
  if (['delivered', 'read', 'replied'].includes(delivery)) return delivery;
  // status='sent' wins over a stale delivery_status='scheduled'
  if (status === 'sent') return 'sent';
  // Otherwise fall back to whatever non-scheduled delivery info we have
  if (delivery && delivery !== 'scheduled') return delivery;
  if (status) return status;
  return 'pending';
};

export function LiveFeed({ branchId }: { branchId?: string }) {
  const qc = useQueryClient();
  const [channel, setChannel] = useState<ChannelKey>('all');
  const [statusFilter, setStatusFilter] = useState<string>('total');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['comm-live-feed', branchId],
    queryFn: async () => {
      let q = supabase
        .from('communication_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (branchId) q = q.eq('branch_id', branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const [livePulse, setLivePulse] = useState(0);

  useEffect(() => {
    const invalidate = () => {
      qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'comm-live-feed' });
      setLivePulse((p) => p + 1);
    };
    const ch = supabase
      .channel('comm-live-feed-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'communication_logs' }, invalidate)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'communication_delivery_events' }, invalidate)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const counts: KpiCounts = useMemo(() => {
    const c: KpiCounts = { total: logs.length, sent: 0, delivered: 0, read: 0, replied: 0, failed: 0, pending: 0 };
    for (const l of logs as any[]) {
      const s = normalizeStatus(l);
      if (s === 'sent') c.sent++;
      else if (s === 'delivered') c.delivered++;
      else if (s === 'read') c.read++;
      else if (s === 'replied') c.replied++;
      else if (s === 'failed' || s === 'bounced') c.failed++;
      else c.pending++;
    }
    // Sent should be cumulative of all that left the queue
    c.sent = c.sent + c.delivered + c.read + c.replied;
    return c;
  }, [logs]);

  const filtered = useMemo(() => {
    return (logs as any[]).filter((l) => {
      if (channel !== 'all' && l.type !== channel) return false;
      const s = normalizeStatus(l);
      if (statusFilter !== 'total') {
        if (statusFilter === 'sent' && !['sent', 'delivered', 'read', 'replied'].includes(s)) return false;
        if (statusFilter === 'failed' && !['failed', 'bounced'].includes(s)) return false;
        if (!['sent', 'failed'].includes(statusFilter) && s !== statusFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!(`${l.recipient || ''} ${l.subject || ''} ${l.content || ''}`).toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [logs, channel, statusFilter, search]);

  return (
    <div className="space-y-4">
      <KpiStrip counts={counts} activeKey={statusFilter} onSelect={setStatusFilter} />

      <Card className="rounded-2xl border-border/50 shadow-lg shadow-primary/5 overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-card to-muted/20 border-b border-border/50">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </div>
              <span className="text-sm font-semibold text-foreground">Live Feed</span>
              <Badge variant="outline" className="rounded-full text-[10px] tabular-nums">{filtered.length}</Badge>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search recipient, subject…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 rounded-xl w-full sm:w-64"
                />
              </div>
              <Tabs value={channel} onValueChange={(v) => setChannel(v as ChannelKey)}>
                <TabsList className="rounded-xl bg-muted/50 h-9">
                  <TabsTrigger value="all" className="rounded-lg text-xs h-7">All</TabsTrigger>
                  <TabsTrigger value="whatsapp" className="rounded-lg text-xs h-7 gap-1"><MessageSquare className="h-3 w-3" /></TabsTrigger>
                  <TabsTrigger value="sms" className="rounded-lg text-xs h-7 gap-1"><Phone className="h-3 w-3" /></TabsTrigger>
                  <TabsTrigger value="email" className="rounded-lg text-xs h-7 gap-1"><Mail className="h-3 w-3" /></TabsTrigger>
                  <TabsTrigger value="in_app" className="rounded-lg text-xs h-7 gap-1"><Bell className="h-3 w-3" /></TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Send className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium">No messages</p>
              <p className="text-xs text-muted-foreground">Adjust filters or send a broadcast</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="divide-y divide-border/50">
                {filtered.map((log: any, i: number) => {
                  const ch = channelMeta[log.type] || channelMeta.in_app;
                  const Icon = ch.icon;
                  const status = normalizeStatus(log);
                  const isOpen = expanded === log.id;
                  return (
                    <div key={log.id} style={{ animationDelay: `${Math.min(i, 20) * 20}ms` }} className="animate-fade-in">
                      <button
                        onClick={() => setExpanded(isOpen ? null : log.id)}
                        className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0', ch.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground truncate">{log.recipient}</span>
                            <Badge variant="outline" className="rounded-full text-[10px] capitalize">{ch.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {log.subject ? <span className="font-medium text-foreground/80">{log.subject} · </span> : null}
                            {log.content}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {statusBadge(status)}
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {format(new Date(log.created_at), 'HH:mm:ss')}
                          </span>
                        </div>
                        <div className="text-muted-foreground/60">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="bg-muted/20 border-t border-border/50 animate-accordion-down">
                          <DeliveryTimeline logId={log.id} />
                          {log.error_message && (
                            <div className="px-4 pb-3 text-xs text-rose-600 dark:text-rose-400">
                              <strong>Error:</strong> {log.error_message}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
