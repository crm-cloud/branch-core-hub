import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, FunnelChart, Funnel, LabelList } from 'recharts';
import { STATUS_CONFIG, LEAD_STATUSES } from './LeadFilters';

interface LeadAnalyticsProps {
  leads: any[];
}

const FUNNEL_COLORS = ['hsl(var(--primary))', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#6b7280'];
const PIE_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#6b7280', '#ec4899'];

export function LeadAnalytics({ leads }: LeadAnalyticsProps) {
  // Funnel data
  const funnelData = LEAD_STATUSES.map((status, i) => ({
    name: STATUS_CONFIG[status].label,
    value: leads.filter(l => l.status === status).length,
    fill: FUNNEL_COLORS[i] || '#6b7280',
  })).filter(d => d.value > 0);

  // Source breakdown
  const sourceCounts: Record<string, number> = {};
  const sourceConverted: Record<string, number> = {};
  leads.forEach(l => {
    const src = l.source || 'Direct';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    if (l.status === 'converted') sourceConverted[src] = (sourceConverted[src] || 0) + 1;
  });
  const sourceData = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, total]) => ({
      name,
      total,
      converted: sourceConverted[name] || 0,
      rate: total > 0 ? Math.round(((sourceConverted[name] || 0) / total) * 100) : 0,
    }));

  // Lost reasons
  const lostReasons: Record<string, number> = {};
  leads.filter(l => l.status === 'lost' && l.lost_reason).forEach(l => {
    lostReasons[l.lost_reason] = (lostReasons[l.lost_reason] || 0) + 1;
  });
  const lostData = Object.entries(lostReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value], i) => ({ name, value, fill: PIE_COLORS[i] }));

  // Temperature breakdown
  const tempData = [
    { name: 'Hot 🔥', value: leads.filter(l => l.temperature === 'hot').length, fill: '#ef4444' },
    { name: 'Warm ☀️', value: leads.filter(l => l.temperature === 'warm').length, fill: '#f59e0b' },
    { name: 'Cold ❄️', value: leads.filter(l => l.temperature === 'cold').length, fill: '#3b82f6' },
  ].filter(d => d.value > 0);

  // Conversion rate
  const totalLeads = leads.length;
  const convertedLeads = leads.filter(l => l.status === 'converted').length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  // Response time
  const leadsWithResponse = leads.filter(l => l.first_response_at && l.created_at);
  const avgResponseHours = leadsWithResponse.length > 0
    ? Math.round(leadsWithResponse.reduce((sum, l) => {
        const diff = new Date(l.first_response_at).getTime() - new Date(l.created_at).getTime();
        return sum + diff / (1000 * 60 * 60);
      }, 0) / leadsWithResponse.length)
    : null;

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card className="rounded-2xl border-border/50 shadow-lg shadow-primary/5">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Conversion Rate</p>
            <p className="text-2xl font-bold text-foreground">{conversionRate}%</p>
            <p className="text-xs text-muted-foreground">{convertedLeads} of {totalLeads}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-lg shadow-primary/5">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Avg Response Time</p>
            <p className="text-2xl font-bold text-foreground">{avgResponseHours !== null ? `${avgResponseHours}h` : '—'}</p>
            <p className="text-xs text-muted-foreground">{leadsWithResponse.length} leads measured</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-lg shadow-primary/5">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Hot Leads</p>
            <p className="text-2xl font-bold text-foreground">{leads.filter(l => l.temperature === 'hot').length}</p>
            <p className="text-xs text-muted-foreground">Require immediate action</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-lg shadow-primary/5">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Overdue Follow-ups</p>
            <p className="text-2xl font-bold text-foreground">
              {leads.filter(l => l.next_action_at && new Date(l.next_action_at) < new Date()).length}
            </p>
            <p className="text-xs text-destructive">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Source Performance */}
        <Card className="rounded-2xl border-border/50 shadow-lg shadow-primary/5">
          <CardHeader><CardTitle className="text-base">Leads by Source</CardTitle></CardHeader>
          <CardContent>
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={sourceData} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val: number, name: string) => [val, name === 'total' ? 'Total' : 'Converted']} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} opacity={0.3} />
                  <Bar dataKey="converted" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No source data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Temperature Distribution */}
        <Card className="rounded-2xl border-border/50 shadow-lg shadow-primary/5">
          <CardHeader><CardTitle className="text-base">Temperature Distribution</CardTitle></CardHeader>
          <CardContent>
            {tempData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={tempData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {tempData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No temperature data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Lost Reasons */}
        <Card className="rounded-2xl border-border/50 shadow-lg shadow-primary/5">
          <CardHeader><CardTitle className="text-base">Lost Reasons</CardTitle></CardHeader>
          <CardContent>
            {lostData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={lostData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {lostData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No lost leads with reasons</p>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Funnel */}
        <Card className="rounded-2xl border-border/50 shadow-lg shadow-primary/5">
          <CardHeader><CardTitle className="text-base">Pipeline Stages</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {funnelData.map((stage, i) => {
                const maxVal = Math.max(...funnelData.map(d => d.value), 1);
                const width = Math.max(10, (stage.value / maxVal) * 100);
                return (
                  <div key={stage.name} className="flex items-center gap-3">
                    <span className="text-xs w-24 text-right text-muted-foreground">{stage.name}</span>
                    <div className="flex-1 h-6 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full flex items-center justify-end pr-2 text-xs font-bold text-primary-foreground"
                        style={{ width: `${width}%`, backgroundColor: stage.fill }}
                      >
                        {stage.value}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
