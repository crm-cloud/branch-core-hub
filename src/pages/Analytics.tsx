import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3, Users, CreditCard, TrendingUp, Calendar, PieChart } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
  // Basic stats query
  const { data: stats } = useQuery({
    queryKey: ['analytics-stats'],
    queryFn: async () => {
      const [membersRes, paymentsRes, invoicesRes] = await Promise.all([
        supabase.from('members').select('id', { count: 'exact', head: true }),
        supabase.from('payments').select('amount').eq('status', 'completed'),
        supabase.from('invoices').select('total_amount, status'),
      ]);
      
      const totalRevenue = paymentsRes.data?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const pendingAmount = invoicesRes.data
        ?.filter((i: any) => i.status === 'pending' || i.status === 'partial')
        .reduce((sum, i) => sum + i.total_amount, 0) || 0;

      return {
        totalMembers: membersRes.count || 0,
        totalRevenue,
        pendingAmount,
      };
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
      
      // Group by month
      const grouped = data.reduce((acc: Record<string, number>, m) => {
        const month = format(new Date(m.created_at), 'yyyy-MM');
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {});
      
      // Calculate cumulative growth
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

  // Collection rate by status
  const { data: collectionData = [], isLoading: collectionLoading } = useQuery({
    queryKey: ['analytics-collection-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select('total_amount, amount_paid, status');
      
      if (!data || data.length === 0) return [];
      
      const paid = data.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total_amount, 0);
      const partial = data.filter(i => i.status === 'partial').reduce((sum, i) => sum + (i.amount_paid || 0), 0);
      const pending = data.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.total_amount, 0);
      const overdue = data.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.total_amount, 0);
      
      return [
        { name: 'Collected', value: paid + partial, fill: 'hsl(var(--chart-2))' },
        { name: 'Pending', value: pending, fill: 'hsl(var(--chart-4))' },
        { name: 'Overdue', value: overdue, fill: 'hsl(var(--destructive))' },
      ].filter(item => item.value > 0);
    },
  });

  // Revenue by plan type
  const { data: revenueByPlan = [], isLoading: planLoading } = useQuery({
    queryKey: ['analytics-revenue-by-plan'],
    queryFn: async () => {
      const { data } = await supabase
        .from('memberships')
        .select(`
          price_paid,
          membership_plans(name)
        `);
      
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">Business performance insights</p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalMembers || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{(stats?.totalRevenue || 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Dues</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">₹{(stats?.pendingAmount || 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Collection Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {stats?.totalRevenue && stats?.pendingAmount 
                  ? Math.round((stats.totalRevenue / (stats.totalRevenue + stats.pendingAmount)) * 100)
                  : 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Monthly Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Monthly Revenue
              </CardTitle>
              <CardDescription>Revenue trends over the last 12 months</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {revenueLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : revenueByMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis 
                      tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                      labelFormatter={(label, payload) => payload[0]?.payload?.fullMonth || label}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
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
            </CardContent>
          </Card>

          {/* Membership Growth Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
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
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="totalMembers"
                      name="Total Members"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary) / 0.2)"
                    />
                    <Area
                      type="monotone"
                      dataKey="newMembers"
                      name="New Members"
                      stroke="hsl(var(--chart-2))"
                      fill="hsl(var(--chart-2) / 0.2)"
                    />
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
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Collection Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Collection Status
              </CardTitle>
              <CardDescription>Distribution of invoice payments</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {collectionLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : collectionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={collectionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {collectionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Amount']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <PieChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No invoice data yet</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue by Plan */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
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
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      type="number"
                      tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      type="category"
                      dataKey="name"
                      className="text-xs"
                      width={100}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
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
