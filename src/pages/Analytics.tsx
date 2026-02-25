import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, CreditCard, TrendingUp, Calendar, AlertCircle, DollarSign, ShoppingBag, Package, ArrowUp, ArrowDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, getDay } from 'date-fns';
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
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AnalyticsPage() {
  // Basic stats query
  const { data: stats } = useQuery({
    queryKey: ['analytics-stats'],
    queryFn: async () => {
      const [membersRes, paymentsRes, invoicesRes] = await Promise.all([
        supabase.from('members').select('id', { count: 'exact', head: true }),
        supabase.from('payments').select('amount').eq('status', 'completed'),
        supabase.from('invoices').select('total_amount, amount_paid, status'),
      ]);

      const totalRevenue = paymentsRes.data?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const pendingAmount = invoicesRes.data
        ?.filter((i: any) => i.status === 'pending' || i.status === 'partial' || i.status === 'overdue')
        .reduce((sum, i) => sum + ((i.total_amount || 0) - (i.amount_paid || 0)), 0) || 0;

      return { totalMembers: membersRes.count || 0, totalRevenue, pendingAmount };
    },
    refetchInterval: 60000,
  });

  // Total expenses
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
          .from('payments').select('amount')
          .gte('payment_date', monthStart).lte('payment_date', monthEnd)
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

  // Membership growth
  const { data: memberGrowth = [], isLoading: growthLoading } = useQuery({
    queryKey: ['analytics-member-growth'],
    queryFn: async () => {
      const { data } = await supabase.from('members').select('created_at').order('created_at');
      if (!data || data.length === 0) return [];
      const grouped = data.reduce((acc: Record<string, number>, m) => {
        const month = format(new Date(m.created_at), 'yyyy-MM');
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {});
      let cumulative = 0;
      return Object.entries(grouped).slice(-12).map(([month, count]) => {
        cumulative += count as number;
        return { name: format(new Date(month + '-01'), 'MMM yy'), newMembers: count as number, totalMembers: cumulative };
      });
    },
  });

  // Member retention / status data
  const { data: memberStatusData = [] } = useQuery({
    queryKey: ['analytics-member-status'],
    queryFn: async () => {
      const { data } = await supabase.from('memberships').select('status');
      if (!data || data.length === 0) return [];
      const counts: Record<string, number> = {};
      data.forEach((m: any) => { const s = m.status || 'unknown'; counts[s] = (counts[s] || 0) + 1; });
      const colorMap: Record<string, string> = {
        active: 'hsl(142, 71%, 45%)', expired: 'hsl(0, 84%, 60%)',
        frozen: 'hsl(217, 91%, 60%)', cancelled: 'hsl(25, 95%, 53%)',
      };
      return Object.entries(counts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1), value,
        fill: colorMap[name] || 'hsl(var(--muted-foreground))',
      }));
    },
  });

  // Revenue by plan type
  const { data: revenueByPlan = [], isLoading: planLoading } = useQuery({
    queryKey: ['analytics-revenue-by-plan'],
    queryFn: async () => {
      const { data } = await supabase.from('memberships').select(`price_paid, membership_plans(name)`);
      if (!data || data.length === 0) return [];
      const grouped = data.reduce((acc: Record<string, number>, m: any) => {
        const planName = m.membership_plans?.name || 'Other';
        acc[planName] = (acc[planName] || 0) + (m.price_paid || 0);
        return acc;
      }, {});
      return Object.entries(grouped)
        .map(([name, value], index) => ({ name, value, fill: CHART_COLORS[index % CHART_COLORS.length] }))
        .sort((a, b) => b.value - a.value).slice(0, 5);
    },
  });

  // ===== NEW: Weekly Earnings =====
  const { data: weeklyEarnings = [] } = useQuery({
    queryKey: ['analytics-weekly-earnings'],
    queryFn: async () => {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
      const { data } = await supabase
        .from('payments').select('amount, payment_date')
        .gte('payment_date', weekStart).lte('payment_date', weekEnd)
        .eq('status', 'completed');
      const dayTotals: number[] = [0, 0, 0, 0, 0, 0, 0];
      data?.forEach((p) => {
        const d = getDay(new Date(p.payment_date));
        const idx = d === 0 ? 6 : d - 1; // Mon=0 ... Sun=6
        dayTotals[idx] += p.amount;
      });
      return DAY_NAMES.map((name, i) => ({ name, earnings: dayTotals[i] }));
    },
  });

  // ===== NEW: Popular Products =====
  const { data: popularProducts = [] } = useQuery({
    queryKey: ['analytics-popular-products'],
    queryFn: async () => {
      const { data: items } = await supabase
        .from('invoice_items')
        .select('reference_id, quantity, description, unit_price')
        .eq('reference_type', 'product');
      if (!items || items.length === 0) return [];
      const grouped: Record<string, { name: string; price: number; qty: number }> = {};
      items.forEach((item) => {
        const key = item.reference_id || item.description;
        if (!grouped[key]) grouped[key] = { name: item.description, price: item.unit_price, qty: 0 };
        grouped[key].qty += item.quantity || 1;
      });
      return Object.values(grouped).sort((a, b) => b.qty - a.qty).slice(0, 5);
    },
  });

  // ===== NEW: Recent Store Orders =====
  const { data: storeOrders = [] } = useQuery({
    queryKey: ['analytics-store-orders'],
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, status, created_at, member_id, members(full_name)')
        .not('pos_sale_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const formatCurrency = (value: number) => `₹${value.toLocaleString()}`;
  const collectionRate = stats?.totalRevenue && stats?.pendingAmount
    ? Math.round((stats.totalRevenue / (stats.totalRevenue + stats.pendingAmount)) * 100) : 0;
  const netProfit = (stats?.totalRevenue || 0) - totalExpenses;
  const activeMemberships = memberStatusData.find(s => s.name === 'Active')?.value || 0;
  const totalMemberships = memberStatusData.reduce((s, d) => s + d.value, 0);
  const retentionRate = totalMemberships > 0 ? Math.round((activeMemberships / totalMemberships) * 100) : 0;
  const weeklyTotal = weeklyEarnings.reduce((s, d) => s + d.earnings, 0);
  const totalProductsSold = popularProducts.reduce((s, p) => s + p.qty, 0);

  const ordersByStatus = (status: string) => {
    const statusMap: Record<string, string[]> = {
      new: ['pending', 'draft'],
      processing: ['partial', 'overdue'],
      completed: ['paid'],
    };
    return storeOrders.filter((o: any) => (statusMap[status] || []).includes(o.status));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Hero Gradient Card */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 p-6 text-white">
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
                {(stats?.pendingAmount || 0) > 0 && <Badge className="bg-pink-500 text-white text-xs mt-1">Due</Badge>}
                <p className="text-white/70 text-xs mt-1">Pending Dues</p>
              </div>
            </div>
          </div>
        </div>

        {/* Earning Reports + Member Retention */}
        <div className="grid gap-6 md:grid-cols-2">
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
                  <div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
                ) : revenueByMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenue']} labelFormatter={(label, payload) => payload[0]?.payload?.fullMonth || label} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: 'none', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="revenue" fill="hsl(262, 83%, 58%)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground"><div className="text-center"><CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No revenue data yet</p></div></div>
                )}
              </div>
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
                        <Pie data={memberStatusData} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={3} dataKey="value">
                          {memberStatusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [value, 'Members']} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: 'none', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      </RechartsPie>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-slate-800">{retentionRate}%</p>
                        <p className="text-xs text-muted-foreground">Active</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground"><div className="text-center"><Users className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No membership data yet</p></div></div>
                )}
              </div>
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

        {/* NEW: Weekly Earnings + Popular Products + Recent Store Orders */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Widget A: Weekly Earning Reports */}
          <Card className="rounded-2xl border-none shadow-lg shadow-indigo-100">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-violet-500" />
                Weekly Earnings
              </CardTitle>
              <CardDescription>This week's daily revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyEarnings}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), 'Earnings']} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: 'none', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="earnings" fill="hsl(262, 83%, 58%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center"><TrendingUp className="h-4 w-4 text-green-600" /></div>
                    <div><p className="text-sm font-medium text-slate-800">Net Profit</p><p className="text-xs text-muted-foreground">Weekly income - expenses</p></div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">{formatCurrency(weeklyTotal - (totalExpenses / 4))}</p>
                    <span className="text-xs text-green-600 flex items-center gap-0.5 justify-end"><ArrowUp className="h-3 w-3" />Net</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center"><DollarSign className="h-4 w-4 text-violet-600" /></div>
                    <div><p className="text-sm font-medium text-slate-800">Total Income</p><p className="text-xs text-muted-foreground">Payments collected</p></div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">{formatCurrency(weeklyTotal)}</p>
                    <span className="text-xs text-green-600 flex items-center gap-0.5 justify-end"><ArrowUp className="h-3 w-3" />Income</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center"><AlertCircle className="h-4 w-4 text-orange-500" /></div>
                    <div><p className="text-sm font-medium text-slate-800">Total Expenses</p><p className="text-xs text-muted-foreground">Approved expenses</p></div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">{formatCurrency(totalExpenses)}</p>
                    <span className="text-xs text-orange-500 flex items-center gap-0.5 justify-end"><ArrowDown className="h-3 w-3" />Cost</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Widget B: Popular Products */}
          <Card className="rounded-2xl border-none shadow-lg shadow-indigo-100">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Package className="h-5 w-5 text-violet-500" />
                Popular Products
              </CardTitle>
              <CardDescription>Total {totalProductsSold} items sold</CardDescription>
            </CardHeader>
            <CardContent>
              {popularProducts.length > 0 ? (
                <div className="space-y-4">
                  {popularProducts.map((product, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-violet-50 flex items-center justify-center">
                          <ShoppingBag className="h-5 w-5 text-violet-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800 truncate max-w-[140px]">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(product.price)}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs font-bold">{product.qty} sold</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center"><Package className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No product sales yet</p></div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Widget C: Recent Store Orders */}
          <Card className="rounded-2xl border-none shadow-lg shadow-indigo-100">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-violet-500" />
                Recent Store Orders
              </CardTitle>
              <CardDescription>POS &amp; store sales overview</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="new" className="w-full">
                <TabsList className="w-full grid grid-cols-3 mb-4">
                  <TabsTrigger value="new">New</TabsTrigger>
                  <TabsTrigger value="processing">Processing</TabsTrigger>
                  <TabsTrigger value="completed">Completed</TabsTrigger>
                </TabsList>
                {['new', 'processing', 'completed'].map((tab) => (
                  <TabsContent key={tab} value={tab}>
                    {ordersByStatus(tab).length > 0 ? (
                      <div className="space-y-3">
                        {ordersByStatus(tab).map((order: any) => {
                          const dotColor = tab === 'new' ? 'bg-blue-500' : tab === 'processing' ? 'bg-orange-500' : 'bg-green-500';
                          return (
                            <div key={order.id} className="flex items-center justify-between py-1">
                              <div className="flex items-center gap-3">
                                <div className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
                                <div>
                                  <p className="text-sm font-medium text-slate-800">{(order as any).members?.full_name || 'Walk-in'}</p>
                                  <p className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'dd MMM yyyy')}</p>
                                </div>
                              </div>
                              <span className="text-sm font-bold text-slate-800">{formatCurrency(order.total_amount)}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-muted-foreground text-sm">No {tab} orders</div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-6 md:grid-cols-2">
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
                <div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
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
                <div className="h-full flex items-center justify-center text-muted-foreground"><div className="text-center"><Users className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No member data yet</p></div></div>
              )}
            </CardContent>
          </Card>

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
                <div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
              ) : revenueByPlan.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByPlan} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis type="number" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenue']} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: 'none', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {revenueByPlan.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground"><div className="text-center"><Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No membership data yet</p></div></div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
