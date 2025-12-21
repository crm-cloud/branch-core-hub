import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, TrendingDown, Wallet, 
  ArrowUpRight, ArrowDownRight, FileText, Building2 
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function FinancePage() {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | null>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('id, name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch income data (payments)
  const { data: incomeData = [] } = useQuery({
    queryKey: ['finance-income', selectedBranch, dateRange],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select('*, member:members(member_code), invoice:invoices(invoice_number)')
        .eq('status', 'completed');

      if (selectedBranch && selectedBranch !== 'all') query = query.eq('branch_id', selectedBranch);
      if (dateRange) {
        query = query.gte('payment_date', dateRange.from.toISOString())
                     .lte('payment_date', dateRange.to.toISOString());
      }

      const { data, error } = await query.order('payment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch expense data
  const { data: expenseData = [] } = useQuery({
    queryKey: ['finance-expenses', selectedBranch, dateRange],
    queryFn: async () => {
      let query = supabase
        .from('expenses')
        .select('*, category:expense_categories(name)')
        .eq('status', 'approved');

      if (selectedBranch && selectedBranch !== 'all') query = query.eq('branch_id', selectedBranch);
      if (dateRange) {
        query = query.gte('expense_date', dateRange.from.toISOString())
                     .lte('expense_date', dateRange.to.toISOString());
      }

      const { data, error } = await query.order('expense_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate totals
  const totalIncome = incomeData.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalExpenses = expenseData.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0;

  // Income by payment method
  const incomeByMethod = incomeData.reduce((acc: Record<string, number>, p) => {
    const method = p.payment_method || 'other';
    acc[method] = (acc[method] || 0) + (p.amount || 0);
    return acc;
  }, {});

  const incomeMethodData = Object.entries(incomeByMethod).map(([name, value]) => ({
    name: name.replace('_', ' ').toUpperCase(),
    value,
  }));

  // Expense by category
  const expenseByCategory = expenseData.reduce((acc: Record<string, number>, e) => {
    const category = e.category?.name || 'Other';
    acc[category] = (acc[category] || 0) + (e.amount || 0);
    return acc;
  }, {});

  const expenseCategoryData = Object.entries(expenseByCategory).map(([name, value]) => ({
    name,
    value,
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Finance Dashboard</h1>
            <p className="text-muted-foreground">Track income, expenses and financial health</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-[200px]">
                <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((branch: any) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Total Income"
            value={formatCurrency(totalIncome)}
            icon={TrendingUp}
            variant="success"
          />
          <StatCard
            title="Total Expenses"
            value={formatCurrency(totalExpenses)}
            icon={TrendingDown}
            variant="destructive"
          />
          <StatCard
            title="Net Profit"
            value={formatCurrency(netProfit)}
            description={`${profitMargin}% margin`}
            icon={Wallet}
            variant={netProfit >= 0 ? 'success' : 'destructive'}
          />
          <StatCard
            title="Transactions"
            value={incomeData.length + expenseData.length}
            description={`${incomeData.length} income, ${expenseData.length} expense`}
            icon={FileText}
            variant="default"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Income by Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={incomeMethodData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {incomeMethodData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expenses by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expenseCategoryData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                    <YAxis type="category" dataKey="name" width={100} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="value" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Income/Expenses */}
        <Tabs defaultValue="income" className="space-y-4">
          <TabsList>
            <TabsTrigger value="income" className="gap-2">
              <ArrowUpRight className="h-4 w-4 text-green-500" />
              Income ({incomeData.length})
            </TabsTrigger>
            <TabsTrigger value="expenses" className="gap-2">
              <ArrowDownRight className="h-4 w-4 text-red-500" />
              Expenses ({expenseData.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="income">
            <Card>
              <CardHeader>
                <CardTitle>Income Transactions</CardTitle>
                <CardDescription>All payments received</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomeData.slice(0, 20).map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{format(new Date(payment.payment_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{payment.member?.member_code || '-'}</TableCell>
                        <TableCell>{payment.invoice?.invoice_number || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{payment.payment_method?.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          +{formatCurrency(payment.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {incomeData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No income transactions found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses">
            <Card>
              <CardHeader>
                <CardTitle>Expense Transactions</CardTitle>
                <CardDescription>All approved expenses</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseData.slice(0, 20).map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{format(new Date(expense.expense_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{expense.category?.name || 'Uncategorized'}</Badge>
                        </TableCell>
                        <TableCell>{expense.description}</TableCell>
                        <TableCell>{expense.vendor || '-'}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          -{formatCurrency(expense.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {expenseData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No expense transactions found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
