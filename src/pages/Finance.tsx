import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, TrendingDown, Wallet, 
  ArrowUpRight, ArrowDownRight, FileText, Building2, Plus, Clock, CheckCircle, XCircle, Download
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AddExpenseDrawer } from '@/components/finance/AddExpenseDrawer';
import { toast } from 'sonner';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function FinancePage() {
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [expenseTab, setExpenseTab] = useState<string>('approved');
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
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

  // Calculate totals - Include POS sales that don't have invoice_id (legacy)
  const posSalesWithoutPayment = posSalesData.filter((sale: any) => !sale.invoice_id);
  const posOnlyTotal = posSalesWithoutPayment.reduce((sum: number, sale: any) => sum + (sale.total_amount || 0), 0);
  const paymentsTotal = incomeData.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalIncome = paymentsTotal + posOnlyTotal;
  const totalExpenses = expenseData.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0;
  
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

  // Income by payment method (include all sources)
  const incomeByMethod = combinedIncomeData.reduce((acc: Record<string, number>, p: any) => {
    const method = p.payment_method || 'other';
    acc[method] = (acc[method] || 0) + (p.amount || 0);
    return acc;
  }, {});

  const incomeMethodData = Object.entries(incomeByMethod).map(([name, value]) => ({
    name: name.replace('_', ' ').toUpperCase(),
    value,
  }));

  // Income by source type
  const incomeBySource = combinedIncomeData.reduce((acc: Record<string, number>, p: any) => {
    const source = p.type || 'Other';
    acc[source] = (acc[source] || 0) + (p.amount || 0);
    return acc;
  }, {});

  const incomeSourceData = Object.entries(incomeBySource).map(([name, value]) => ({
    name,
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

  // Get first branch for expense drawer
  const defaultBranchId = branches[0]?.id || '';

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
            <Button onClick={() => setAddExpenseOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
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
            value={combinedIncomeData.length + expenseData.length}
            description={`${combinedIncomeData.length} income, ${expenseData.length} expense`}
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
              Income ({combinedIncomeData.length})
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
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Expense Transactions</CardTitle>
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

      <AddExpenseDrawer
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        branchId={selectedBranch !== 'all' ? selectedBranch : defaultBranchId}
      />
    </AppLayout>
  );
}
