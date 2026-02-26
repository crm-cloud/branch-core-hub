import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useBranchContext } from '@/contexts/BranchContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/ui/date-range-filter';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, TrendingDown, Wallet, 
  ArrowUpRight, ArrowDownRight, Plus, Clock, CheckCircle, XCircle, Download,
  CreditCard, Banknote, Smartphone, Receipt
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { AddExpenseDrawer } from '@/components/finance/AddExpenseDrawer';
import { toast } from 'sonner';

export default function FinancePage() {
  const queryClient = useQueryClient();
  const { selectedBranch, effectiveBranchId, branchFilter } = useBranchContext();
  const [expenseTab, setExpenseTab] = useState<string>('approved');
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | null>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Fetch income data (payments)
  const { data: incomeData = [] } = useQuery({
    queryKey: ['finance-income', selectedBranch, dateRange],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select('*, member:members(member_code), invoice:invoices(invoice_number, pos_sale_id)')
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

  // Fetch POS sales (for income that might not have payment records)
  const { data: posSalesData = [] } = useQuery({
    queryKey: ['finance-pos-sales', selectedBranch, dateRange],
    queryFn: async () => {
      let query = supabase
        .from('pos_sales')
        .select('*, members(member_code)')
        .order('sale_date', { ascending: false });

      if (selectedBranch && selectedBranch !== 'all') query = query.eq('branch_id', selectedBranch);
      if (dateRange) {
        query = query.gte('sale_date', dateRange.from.toISOString())
                     .lte('sale_date', dateRange.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch approved expense data
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

  // Fetch pending expenses for approval
  const { data: pendingExpenses = [] } = useQuery({
    queryKey: ['pending-expenses', selectedBranch],
    queryFn: async () => {
      let query = supabase
        .from('expenses')
        .select('*, category:expense_categories(name)')
        .eq('status', 'pending');

      if (selectedBranch && selectedBranch !== 'all') query = query.eq('branch_id', selectedBranch);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Monthly revenue report data (last 6 months for bar chart)
  const { data: monthlyReportData = [] } = useQuery({
    queryKey: ['finance-monthly-report', selectedBranch],
    queryFn: async () => {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const monthStart = startOfMonth(date).toISOString();
        const monthEnd = endOfMonth(date).toISOString();

        let payQuery = supabase.from('payments').select('amount').gte('payment_date', monthStart).lte('payment_date', monthEnd).eq('status', 'completed');
        let expQuery = supabase.from('expenses').select('amount').gte('expense_date', monthStart).lte('expense_date', monthEnd).eq('status', 'approved');

        if (selectedBranch && selectedBranch !== 'all') {
          payQuery = payQuery.eq('branch_id', selectedBranch);
          expQuery = expQuery.eq('branch_id', selectedBranch);
        }

        const [payRes, expRes] = await Promise.all([payQuery, expQuery]);

        months.push({
          name: format(date, 'MMM'),
          earning: payRes.data?.reduce((s, p) => s + p.amount, 0) || 0,
          expense: -(expRes.data?.reduce((s, e) => s + e.amount, 0) || 0),
        });
      }
      return months;
    },
  });

  // Approve/Reject expense mutations
  const approveExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase
        .from('expenses')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', expenseId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Expense approved');
      queryClient.invalidateQueries({ queryKey: ['finance-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['pending-expenses'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve expense');
    },
  });

  const rejectExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase
        .from('expenses')
        .update({ status: 'rejected' })
        .eq('id', expenseId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Expense rejected');
      queryClient.invalidateQueries({ queryKey: ['pending-expenses'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject expense');
    },
  });

  // Calculate totals
  const posSalesWithoutPayment = posSalesData.filter((sale: any) => !sale.invoice_id);
  const posOnlyTotal = posSalesWithoutPayment.reduce((sum: number, sale: any) => sum + (sale.total_amount || 0), 0);
  const paymentsTotal = incomeData.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalIncome = paymentsTotal + posOnlyTotal;
  const totalExpenses = expenseData.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : '0';

  // Combined income data for display
  const combinedIncomeData = [
    ...incomeData.map((p: any) => ({
      ...p,
      type: p.invoice?.pos_sale_id ? 'POS Sale' : 'Payment',
      date: p.payment_date,
    })),
    ...posSalesWithoutPayment.map((sale: any) => ({
      id: sale.id,
      amount: sale.total_amount,
      payment_method: sale.payment_method,
      member: sale.members,
      type: 'POS Sale (Legacy)',
      date: sale.sale_date,
      invoice: null,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Export function
  const exportToCSV = () => {
    const incomeRows = combinedIncomeData.map((p: any) => ({
      Type: 'Income',
      Date: format(new Date(p.date), 'yyyy-MM-dd'),
      Description: p.type,
      Category: p.payment_method || '-',
      Amount: p.amount,
    }));
    const expenseRows = expenseData.map((e: any) => ({
      Type: 'Expense',
      Date: format(new Date(e.expense_date), 'yyyy-MM-dd'),
      Description: e.description,
      Category: e.category?.name || 'Uncategorized',
      Amount: -e.amount,
    }));
    const allRows = [...incomeRows, ...expenseRows].sort((a, b) =>
      new Date(b.Date).getTime() - new Date(a.Date).getTime()
    );
    const headers = ['Type', 'Date', 'Description', 'Category', 'Amount'];
    const csv = [
      headers.join(','),
      ...allRows.map(r => headers.map(h => `"${r[h as keyof typeof r]}"`).join(',')),
      '',
      `"Net Profit","","","","${netProfit}"`,
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    toast.success('Financial report exported');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  };

  const defaultBranchId = effectiveBranchId || '';

  // Recent transactions for timeline
  const recentTransactions = [
    ...combinedIncomeData.slice(0, 8).map((p: any) => ({
      id: p.id,
      type: 'income' as const,
      description: p.type,
      method: p.payment_method || 'cash',
      amount: p.amount,
      date: p.date,
      member: p.member?.member_code,
    })),
    ...expenseData.slice(0, 5).map((e: any) => ({
      id: e.id,
      type: 'expense' as const,
      description: e.description,
      method: e.category?.name || 'Other',
      amount: e.amount,
      date: e.expense_date,
      member: null,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

  const getPaymentIcon = (method: string) => {
    if (method?.includes('card') || method?.includes('credit') || method?.includes('debit')) return CreditCard;
    if (method?.includes('bank') || method?.includes('transfer') || method?.includes('neft')) return Banknote;
    if (method?.includes('upi') || method?.includes('online') || method?.includes('razorpay')) return Smartphone;
    return Receipt;
  };

  // Budget sparkline data (monthly totals for sparkline)
  const sparklineData = monthlyReportData.map(m => ({ value: m.earning }));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Finance Dashboard</h1>
            <p className="text-muted-foreground text-sm">Track income, expenses and financial health</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setAddExpenseOpen(true)} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-200 hover:shadow-xl">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
          </div>
        </div>

        {/* Revenue Report + Budget Card Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Revenue Report - Wide */}
          <Card className="lg:col-span-2 rounded-2xl border-none shadow-lg shadow-indigo-100">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800">Revenue Report</CardTitle>
              <CardDescription>Monthly earnings vs expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyReportData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `₹${Math.abs(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatCurrency(Math.abs(value)), name === 'earning' ? 'Earning' : 'Expense']}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: 'none', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="earning" fill="hsl(262, 83%, 58%)" radius={[6, 6, 0, 0]} name="earning" />
                    <Bar dataKey="expense" fill="hsl(25, 95%, 53%)" radius={[0, 0, 6, 6]} name="expense" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Budget Summary Card */}
          <Card className="rounded-2xl border-none shadow-lg shadow-indigo-100">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800">{new Date().getFullYear()} Budget</CardTitle>
              <CardDescription>Financial summary</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-3xl font-bold text-slate-800">{formatCurrency(totalIncome)}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Income</p>
              </div>
              <div className="h-[80px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklineData}>
                    <Line type="monotone" dataKey="value" stroke="hsl(262, 83%, 58%)" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-xl bg-green-50 p-3 text-center">
                  <p className="text-sm font-bold text-green-600">{formatCurrency(netProfit)}</p>
                  <p className="text-xs text-green-600/70">Net Profit</p>
                </div>
                <div className="rounded-xl bg-red-50 p-3 text-center">
                  <p className="text-sm font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
                  <p className="text-xs text-red-500/70">Expenses</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <div className={`flex items-center gap-1 text-xs font-medium ${Number(profitMargin) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {Number(profitMargin) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {profitMargin}% margin
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Timeline + Income/Expense Tables */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Transactions Timeline */}
          <Card className="rounded-2xl border-none shadow-lg shadow-indigo-100">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentTransactions.map((tx) => {
                  const Icon = getPaymentIcon(tx.method);
                  return (
                    <div key={tx.id} className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tx.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">{tx.member || tx.method}</p>
                      </div>
                      <span className={`text-sm font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </span>
                    </div>
                  );
                })}
                {recentTransactions.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No transactions yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Income / Expenses Tabs - Wide */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="income" className="space-y-4">
              <TabsList>
                <TabsTrigger value="income" className="gap-2">
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                  Income ({combinedIncomeData.length})
                </TabsTrigger>
                <TabsTrigger value="expenses" className="gap-2">
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                  Expenses ({expenseData.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="income">
                <Card className="rounded-2xl border-none shadow-lg shadow-indigo-100">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-slate-800">Income Transactions</CardTitle>
                    <CardDescription>All income including memberships, POS sales, and other payments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Member</TableHead>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {combinedIncomeData.slice(0, 30).map((payment: any) => (
                          <TableRow key={payment.id}>
                            <TableCell>{format(new Date(payment.date), 'MMM d, yyyy')}</TableCell>
                            <TableCell>
                              <Badge variant={payment.type.includes('POS') ? 'secondary' : 'outline'}>
                                {payment.type}
                              </Badge>
                            </TableCell>
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
                        {combinedIncomeData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                <Card className="rounded-2xl border-none shadow-lg shadow-indigo-100">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-bold text-slate-800">Expense Transactions</CardTitle>
                        <CardDescription>Manage expense submissions and approvals</CardDescription>
                      </div>
                      <Tabs value={expenseTab} onValueChange={setExpenseTab}>
                        <TabsList>
                          <TabsTrigger value="pending" className="gap-2">
                            <Clock className="h-4 w-4" />
                            Pending ({pendingExpenses.length})
                          </TabsTrigger>
                          <TabsTrigger value="approved" className="gap-2">
                            <CheckCircle className="h-4 w-4" />
                            Approved ({expenseData.length})
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {expenseTab === 'pending' ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingExpenses.map((expense: any) => (
                            <TableRow key={expense.id}>
                              <TableCell>{format(new Date(expense.expense_date), 'MMM d, yyyy')}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{expense.category?.name || 'Uncategorized'}</Badge>
                              </TableCell>
                              <TableCell>{expense.description}</TableCell>
                              <TableCell>{expense.vendor || '-'}</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(expense.amount)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => approveExpenseMutation.mutate(expense.id)}
                                    disabled={approveExpenseMutation.isPending}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => rejectExpenseMutation.mutate(expense.id)}
                                    disabled={rejectExpenseMutation.isPending}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {pendingExpenses.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                No pending expenses
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    ) : (
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
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <AddExpenseDrawer
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        branchId={selectedBranch !== 'all' ? selectedBranch : defaultBranchId}
      />
    </AppLayout>
  );
}
