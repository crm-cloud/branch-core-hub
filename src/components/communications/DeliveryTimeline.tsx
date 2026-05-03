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

const stageMeta: Record<string, { icon: any; ring: string; bg: string; text: string; bar: string; label: string }> = {
  queued:    { icon: Clock,              ring: 'ring-amber-400/50',   bg: 'bg-amber-500',   text: 'text-amber-600',   bar: 'bg-amber-500',   label: 'Queued' },
  sent:      { icon: Send,               ring: 'ring-sky-400/50',     bg: 'bg-sky-500',     text: 'text-sky-600',     bar: 'bg-sky-500',     label: 'Sent' },
  delivered: { icon: CheckCircle2,       ring: 'ring-emerald-400/50', bg: 'bg-emerald-500', text: 'text-emerald-600', bar: 'bg-emerald-500', label: 'Delivered' },
  read:      { icon: Eye,                ring: 'ring-violet-400/50',  bg: 'bg-violet-500',  text: 'text-violet-600',  bar: 'bg-violet-500',  label: 'Read' },
  replied:   { icon: MessageSquareReply, ring: 'ring-indigo-400/50',  bg: 'bg-indigo-500',  text: 'text-indigo-600',  bar: 'bg-indigo-500',  label: 'Replied' },
  failed:    { icon: XCircle,            ring: 'ring-rose-400/50',    bg: 'bg-rose-500',    text: 'text-rose-600',    bar: 'bg-rose-500',    label: 'Failed' },
  bounced:   { icon: AlertCircle,        ring: 'ring-rose-400/50',    bg: 'bg-rose-500',    text: 'text-rose-600',    bar: 'bg-rose-500',    label: 'Bounced' },
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
    return <div className="py-3 text-xs text-muted-foreground text-center">Loading timeline…</div>;
  }

  const reachedStages = new Set(events.map(e => e.new_status));
  const hasFailure = events.some(e => ['failed', 'bounced'].includes(e.new_status));
  const visibleStages = hasFailure ? [...stageOrder.filter(s => reachedStages.has(s)), 'failed'] : stageOrder;

  // Active = latest reached stage (drives pulse)
  const lastEvent = events[events.length - 1];
  const activeStage = lastEvent?.new_status;

  return (
    <div className="py-2 px-1">
      <div className="relative flex items-center justify-between max-w-sm mx-auto">
        {visibleStages.map((stage, idx) => {
          const meta = stageMeta[stage];
          const reached = reachedStages.has(stage);
          const event = events.find(e => e.new_status === stage);
          const Icon = meta.icon;
          const isActive = stage === activeStage;
          const nextStage = visibleStages[idx + 1];
          const nextReached = nextStage && reachedStages.has(nextStage);
          return (
            <div key={stage} className="relative flex-1 flex flex-col items-center">
              {/* Connector to next */}
              {idx < visibleStages.length - 1 && (
                <div className="absolute top-3.5 left-1/2 right-0 h-0.5 -z-0" style={{ width: 'calc(100% - 0px)' }}>
                  <div className={cn(
                    'h-full transition-all duration-500',
                    nextReached ? meta.bar : 'bg-border'
                  )} />
                </div>
              )}
              <div
                className={cn(
                  'relative z-10 h-7 w-7 rounded-full flex items-center justify-center transition-all duration-300',
                  reached
                    ? `${meta.bg} text-white shadow-sm ${isActive ? `ring-4 ${meta.ring} animate-pulse` : ''}`
                    : 'bg-muted text-muted-foreground/40 border border-border'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="mt-1 text-center leading-tight">
                <div className={cn('text-[10px] font-semibold', reached ? meta.text : 'text-muted-foreground/50')}>
                  {meta.label}
                </div>
                {event && (
                  <div className="text-[9px] text-muted-foreground/70 tabular-nums">
                    {format(new Date(event.created_at), 'HH:mm:ss')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {hasFailure && (
        <div className="mt-2 py-1.5 px-2 rounded-md bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 max-w-sm mx-auto">
          <div className="flex items-start gap-1.5">
            <AlertCircle className="h-3 w-3 text-rose-600 mt-0.5 flex-shrink-0" />
            <div className="text-[11px] text-rose-700 dark:text-rose-400 leading-snug">
              {events.find(e => e.error_message)?.error_message || 'Delivery failed'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
