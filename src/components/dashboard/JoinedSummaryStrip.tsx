import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, CalendarRange, CalendarCheck, CalendarClock, type LucideIcon } from 'lucide-react';
import { startOfMonth, startOfYear, subDays, format } from 'date-fns';

interface Props {
  branchFilter: string | null;
}

async function countNewMembers(branchFilter: string | null, gte: string) {
  let q = supabase.from('members').select('id', { count: 'exact', head: true }).gte('created_at', gte);
  if (branchFilter) q = q.eq('branch_id', branchFilter);
  const { count } = await q;
  return count ?? 0;
}

export function JoinedSummaryStrip({ branchFilter }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['joined-summary', branchFilter],
    queryFn: async () => {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const sevenAgo = subDays(now, 7).toISOString();
      const monthStart = startOfMonth(now).toISOString();
      const yearStart = startOfYear(now).toISOString();
      const [t, w, m, y] = await Promise.all([
        countNewMembers(branchFilter, today),
        countNewMembers(branchFilter, sevenAgo),
        countNewMembers(branchFilter, monthStart),
        countNewMembers(branchFilter, yearStart),
      ]);
      return { today: t, week: w, month: m, year: y };
    },
  });

  if (isLoading || !data) {
    return <Skeleton className="h-20 rounded-2xl" />;
  }

  const items: { label: string; value: number; icon: LucideIcon }[] = [
    { label: 'Joined Today', value: data.today, icon: CalendarCheck },
    { label: 'Last 7 Days', value: data.week, icon: CalendarClock },
    { label: 'This Month', value: data.month, icon: CalendarRange },
    { label: 'This Year', value: data.year, icon: CalendarDays },
  ];

  return (
    <Card className="rounded-2xl border-0 shadow-lg shadow-primary/5">
      <CardContent className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {items.map((it) => (
            <div key={it.label} className="flex items-center gap-3 rounded-xl p-3 hover:bg-muted/50 transition-colors">
              <div className="rounded-full bg-primary/10 text-primary p-2">
                <it.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums text-foreground leading-none">{it.value.toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{it.label}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
