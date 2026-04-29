import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Clock, Send, Eye, MessageSquareReply, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Event {
  id: string;
  new_status: string;
  previous_status: string | null;
  provider: string | null;
  error_message: string | null;
  created_at: string;
}

const stageOrder = ['queued', 'sent', 'delivered', 'read', 'replied'];

const stageMeta: Record<string, { icon: any; color: string; label: string }> = {
  queued: { icon: Clock, color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10', label: 'Queued' },
  sent: { icon: Send, color: 'text-sky-500 bg-sky-50 dark:bg-sky-500/10', label: 'Sent' },
  delivered: { icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10', label: 'Delivered' },
  read: { icon: Eye, color: 'text-violet-500 bg-violet-50 dark:bg-violet-500/10', label: 'Read' },
  replied: { icon: MessageSquareReply, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10', label: 'Replied' },
  failed: { icon: XCircle, color: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10', label: 'Failed' },
  bounced: { icon: AlertCircle, color: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10', label: 'Bounced' },
};

export function DeliveryTimeline({ logId }: { logId: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from('communication_delivery_events')
        .select('id,new_status,previous_status,provider,error_message,created_at')
        .eq('communication_log_id', logId)
        .order('created_at', { ascending: true });
      if (active) {
        setEvents((data as any) || []);
        setLoading(false);
      }
    };
    load();
    const ch = supabase
      .channel(`delivery-events-${logId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'communication_delivery_events', filter: `communication_log_id=eq.${logId}` }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [logId]);

  if (loading) {
    return <div className="py-4 text-xs text-muted-foreground">Loading timeline…</div>;
  }

  const reachedStages = new Set(events.map(e => e.new_status));
  const hasFailure = events.some(e => ['failed', 'bounced'].includes(e.new_status));
  const visibleStages = hasFailure ? [...stageOrder.filter(s => reachedStages.has(s)), 'failed'] : stageOrder;

  return (
    <div className="py-3 px-2">
      <div className="relative flex items-center justify-between">
        <div className="absolute left-4 right-4 top-4 h-0.5 bg-border" />
        {visibleStages.map((stage, idx) => {
          const meta = stageMeta[stage];
          const reached = reachedStages.has(stage);
          const event = events.find(e => e.new_status === stage);
          const Icon = meta.icon;
          return (
            <div key={stage} className="relative z-10 flex flex-col items-center gap-1.5 flex-1">
              <div
                style={{ animationDelay: `${idx * 80}ms` }}
                className={cn(
                  'h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all',
                  reached ? `${meta.color} border-current animate-scale-in` : 'bg-muted border-border text-muted-foreground/40'
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-center">
                <div className={cn('text-[11px] font-semibold', reached ? 'text-foreground' : 'text-muted-foreground/60')}>
                  {meta.label}
                </div>
                {event && (
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {format(new Date(event.created_at), 'HH:mm:ss')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {hasFailure && (
        <div className="mt-3 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-rose-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-rose-700 dark:text-rose-400">
              {events.find(e => e.error_message)?.error_message || 'Delivery failed'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
