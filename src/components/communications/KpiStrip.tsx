import { Card, CardContent } from '@/components/ui/card';
import { Users, CheckCircle2, XCircle, Send, Eye, MessageSquareReply, MousePointerClick, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface KpiCounts {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
  pending: number;
  clicked?: number;
}

const items = [
  { key: 'total', label: 'All', icon: Users, accent: 'from-slate-500 to-slate-700', text: 'text-slate-50', sub: 'Total contacts' },
  { key: 'sent', label: 'Sent', icon: Send, accent: 'from-emerald-500 to-emerald-600', text: 'text-emerald-50', sub: 'success rate' },
  { key: 'failed', label: 'Failed', icon: XCircle, accent: 'from-rose-500 to-rose-600', text: 'text-rose-50', sub: 'failure rate' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2, accent: 'from-sky-500 to-sky-600', text: 'text-sky-50', sub: 'delivery rate' },
  { key: 'read', label: 'Read', icon: Eye, accent: 'from-violet-500 to-violet-600', text: 'text-violet-50', sub: 'read rate' },
  { key: 'replied', label: 'Replied', icon: MessageSquareReply, accent: 'from-indigo-500 to-indigo-600', text: 'text-indigo-50', sub: 'reply rate' },
  { key: 'pending', label: 'Pending', icon: Clock, accent: 'from-amber-500 to-amber-600', text: 'text-amber-50', sub: 'in queue' },
] as const;

export function KpiStrip({ counts, activeKey, onSelect }: { counts: KpiCounts; activeKey?: string; onSelect?: (key: string) => void }) {
  const total = Math.max(counts.total, 1);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
      {items.map((it, i) => {
        const value = (counts as any)[it.key] ?? 0;
        const rate = it.key === 'total' ? null : Math.round((value / total) * 1000) / 10;
        const Icon = it.icon;
        const active = activeKey === it.key;
        return (
          <button
            key={it.key}
            onClick={() => onSelect?.(it.key)}
            style={{ animationDelay: `${i * 40}ms` }}
            className={cn(
              'group text-left animate-fade-in transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-2xl',
              active && 'ring-2 ring-primary/60'
            )}
          >
            <Card className={cn(
              'rounded-2xl border-0 overflow-hidden relative shadow-lg',
              `bg-gradient-to-br ${it.accent}`,
              'shadow-black/5'
            )}>
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10" />
              <div className="absolute -bottom-8 -left-4 w-16 h-16 rounded-full bg-white/5" />
              <CardContent className="p-4 relative z-10">
                <div className="flex items-center justify-between">
                  <span className={cn('text-xs font-medium uppercase tracking-wider', it.text, 'opacity-90')}>{it.label}</span>
                  <Icon className={cn('h-4 w-4', it.text, 'opacity-90')} />
                </div>
                <div className={cn('mt-2 text-3xl font-bold tabular-nums', it.text)}>
                  {value.toLocaleString()}
                </div>
                <p className={cn('text-[11px] mt-0.5', it.text, 'opacity-80')}>
                  {rate !== null ? `${rate}% ${it.sub}` : it.sub}
                </p>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
