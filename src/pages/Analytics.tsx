import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, CreditCard, TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
  PieChart as RechartsPie,
  Pie,
  Cell,
} from 'recharts';

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export default function AnalyticsPage() {
  // Basic stats query — fixed pendingAmount logic
  const { data: stats } = useQuery({
    queryKey: ['analytics-stats'],
    queryFn: async () => {
      const [membersRes, paymentsRes, invoicesRes] = await Promise.all([
        supabase.from('members').select('id', { count: 'exact', head: true }),
        supabase.from('payments').select('amount').eq('status', 'completed'),
        supabase.from('invoices').select('total_amount, amount_paid, status'),
      ]);

      const totalRevenue = paymentsRes.data?.reduce((sum, p) => sum + p.amount, 0) || 0;
      // FIX: Calculate actual outstanding = total_amount - amount_paid for pending/partial/overdue
      const pendingAmount = invoicesRes.data
        ?.filter((i: any) => i.status === 'pending' || i.status === 'partial' || i.status === 'overdue')
        .reduce((sum, i) => sum + ((i.total_amount || 0) - (i.amount_paid || 0)), 0) || 0;

      return {
        totalMembers: membersRes.count || 0,
        totalRevenue,
        pendingAmount,
      };
    },
  });

  // Fetch expenses for Earning Reports widget
  const { data: totalExpenses = 0 } = useQuery({
    queryKey: ['analytics-total-expenses'],
    queryFn: async () => {
      const { data } = await supabase.from('expenses').select('amount').eq('status', 'approved');
      return data?.reduce((sum, e) => sum + e.amount, 0) || 0;
    },
  });

  // Monthly revenue for last 12 months
  const { data: revenueByMonth = [], isLoading: revenueLoading } = useQuery({
    queryKey: ['analytics-revenue-by-month'],
    queryFn: async () => {
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const monthStart = startOfMonth(date).toISOString();
        const monthEnd = endOfMonth(date).toISOString();

        const { data } = await supabase
          .from('payments')
          .select('amount')
          .gte('payment_date', monthStart)
          .lte('payment_date', monthEnd)
          .eq('status', 'completed');

        months.push({
          name: format(date, 'MMM'),
          fullMonth: format(date, 'MMM yyyy'),
          revenue: data?.reduce((sum, p) => sum + p.amount, 0) || 0,
        });
      }
      return months;
    },
  });

  // Membership growth by month
  const { data: memberGrowth = [], isLoading: growthLoading } = useQuery({
    queryKey: ['analytics-member-growth'],
    queryFn: async () => {
      const { data } = await supabase
        .from('members')
        .select('created_at')
        .order('created_at');

      if (!data || data.length === 0) return [];

      const grouped = data.reduce((acc: Record<string, number>, m) => {
        const month = format(new Date(m.created_at), 'yyyy-MM');
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {});

      let cumulative = 0;
      return Object.entries(grouped).slice(-12).map(([month, count]) => {
        cumulative += count as number;
        return {
          name: format(new Date(month + '-01'), 'MMM yy'),
          newMembers: count as number,
          totalMembers: cumulative,
        };
      });
    },
  });

  // Member retention / status data
  const { data: memberStatusData = [] } = useQuery({
    queryKey: ['analytics-member-status'],
    queryFn: async () => {
      const { data } = await supabase
        .from('memberships')
        .select('status');

      if (!data || data.length === 0) return [];

      const counts: Record<string, number> = {};
      data.forEach((m: any) => {
        const s = m.status || 'unknown';
        counts[s] = (counts[s] || 0) + 1;
      });

      const colorMap: Record<string, string> = {
        active: 'hsl(142, 71%, 45%)',
        expired: 'hsl(0, 84%, 60%)',
        frozen: 'hsl(217, 91%, 60%)',
        cancelled: 'hsl(25, 95%, 53%)',
      };

      return Object.entries(counts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        fill: colorMap[name] || 'hsl(var(--muted-foreground))',
      }));
    },
  });

  // Revenue by plan type
  const { data: revenueByPlan = [], isLoading: planLoading } = useQuery({
    queryKey: ['analytics-revenue-by-plan'],
    queryFn: async () => {
      const { data } = await supabase
        .from('memberships')
        .select(`price_paid, membership_plans(name)`);

      if (!data || data.length === 0) return [];

      const grouped = data.reduce((acc: Record<string, number>, m: any) => {
        const planName = m.membership_plans?.name || 'Other';
        acc[planName] = (acc[planName] || 0) + (m.price_paid || 0);
        return acc;
      }, {});

      return Object.entries(grouped)
        .map(([name, value], index) => ({
          name,
          value,
          fill: CHART_COLORS[index % CHART_COLORS.length],
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    },
  });

  const formatCurrency = (value: number) => `₹${value.toLocaleString()}`;
  const collectionRate = stats?.totalRevenue && stats?.pendingAmount
    ? Math.round((stats.totalRevenue / (stats.totalRevenue + stats.pendingAmount)) * 100)
    : 0;
  const netProfit = (stats?.totalRevenue || 0) - totalExpenses;
  const activeMemberships = memberStatusData.find(s => s.name === 'Active')?.value || 0;
  const totalMemberships = memberStatusData.reduce((s, d) => s + d.value, 0);
  const retentionRate = totalMemberships > 0 ? Math.round((activeMemberships / totalMemberships) * 100) : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Hero Gradient Card */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Gym Analytics</h1>
              <p className="text-white/70 text-sm mt-1">Complete business performance insights</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{stats?.totalMembers || 0}</p>
                <p className="text-white/70 text-xs mt-1">Total Members</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">₹{((stats?.totalRevenue || 0) / 1000).toFixed(0)}k</p>
                <p className="text-white/70 text-xs mt-1">Total Revenue</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">{collectionRate}%</p>
                <p className="text-white/70 text-xs mt-1">Collection Rate</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">₹{((stats?.pendingAmount || 0) / 1000).toFixed(0)}k</p>
                {(stats?.pendingAmount || 0) > 0 && (
                  <Badge className="bg-pink-500 text-white text-xs mt-1">Due</Badge>
                )}
                <p className="text-white/70 text-xs mt-1">Pending Dues</p>
              </div>
            </div>
          </div>
        </div>

        {/* Earning Reports + Member Retention */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Earning Reports Widget */}
          <Card className="rounded-2xl border-none shadow-lg shadow-indigo-100">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-violet-500" />
                Earning Reports
              </CardTitle>
              <CardDescription>Revenue trends over the last 12 months</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                {revenueLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : revenueByMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                        labelFormatter={(label, payload) => payload[0]?.payload?.fullMonth || label}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: 'none', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="revenue" fill="hsl(262, 83%, 58%)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No revenue data yet</p>
                    </div>
                  </div>
                )}
              </div>
              {/* Summary bars */}
              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 font-medium">Earnings</span>
                    <span className="font-bold text-slate-800">{formatCurrency(stats?.totalRevenue || 0)}</span>
                  </div>
                  <Progress value={100} className="h-2 [&>div]:bg-violet-500" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 font-medium">Profit</span>
                    <span className="font-bold text-green-600">{formatCurrency(netProfit)}</span>
                  </div>
                  <Progress value={stats?.totalRevenue ? (netProfit / stats.totalRevenue) * 100 : 0} className="h-2 [&>div]:bg-green-500" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 font-medium">Expenses</span>
                    <span className="font-bold text-orange-500">{formatCurrency(totalExpenses)}</span>
                  </div>
                  <Progress value={stats?.totalRevenue ? (totalExpenses / stats.totalRevenue) * 100 : 0} className="h-2 [&>div]:bg-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Member Retention Tracker (Donut) */}
          <Card className="rounded-2xl border-none shadow-lg shadow-indigo-100">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Users className="h-5 w-5 text-violet-500" />
                Member Retention
              </CardTitle>
              <CardDescription>Membership status distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] relative">
                {memberStatusData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={memberStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {memberStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [value, 'Members']}
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: 'none', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                      </RechartsPie>
                    </ResponsiveContainer>
                    {/* Center text */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-slate-800">{retentionRate}%</p>
                        <p className="text-xs text-muted-foreground">Active</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No membership data yet</p>
                    </div>
                  </div>
                )}
              </div>
              {/* Legend */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {memberStatusData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.fill }} />
                    <span className="text-xs text-slate-600">{entry.name}</span>
                    <span className="text-xs font-bold text-slate-800 ml-auto">{entry.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Membership Growth */}
          <Card className="rounded-2xl border-none shadow-lg shadow-indigo-100">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-violet-500" />
                Membership Growth
              </CardTitle>
              <CardDescription>New and total members over time</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {growthLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : memberGrowth.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={memberGrowth}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: 'none', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Legend />
                    <Area type="monotone" dataKey="totalMembers" name="Total Members" stroke="hsl(262, 83%, 58%)" fill="hsl(262, 83%, 58%, 0.15)" />
                    <Area type="monotone" dataKey="newMembers" name="New Members" stroke="hsl(142, 71%, 45%)" fill="hsl(142, 71%, 45%, 0.15)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No member data yet</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue by Plan */}
          <Card className="rounded-2xl border-none shadow-lg shadow-indigo-100">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-violet-500" />
                Revenue by Plan
              </CardTitle>
              <CardDescription>Top performing membership plans</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {planLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : revenueByPlan.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByPlan} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis type="number" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: 'none', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {revenueByPlan.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No membership data yet</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
