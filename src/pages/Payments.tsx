import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard } from '@/components/ui/stat-card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { CreditCard, Wallet, TrendingUp, Receipt, Search, Download, Filter, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranchContext } from '@/contexts/BranchContext';
import { useState, useMemo } from 'react';
import { format, isWithinInterval, parseISO } from 'date-fns';

export default function PaymentsPage() {
  const { branchFilter } = useBranchContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>(undefined);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments', branchFilter],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select(`*, members(member_code, profiles:user_id(full_name)), invoices(invoice_number)`)
        .order('payment_date', { ascending: false })
        .limit(200);
      if (branchFilter) query = query.eq('branch_id', branchFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filteredPayments = useMemo(() => {
    return payments.filter((payment: any) => {
      if (searchTerm) {
        const memberName = payment.members?.profiles?.full_name?.toLowerCase() || '';
        const memberCode = payment.members?.member_code?.toLowerCase() || '';
        const invoiceNum = payment.invoices?.invoice_number?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        if (!memberName.includes(search) && !memberCode.includes(search) && !invoiceNum.includes(search)) return false;
      }
      if (methodFilter !== 'all' && payment.payment_method !== methodFilter) return false;
      if (statusFilter !== 'all' && payment.status !== statusFilter) return false;
      if (dateRange?.from && dateRange?.to) {
        const paymentDate = parseISO(payment.payment_date);
        if (!isWithinInterval(paymentDate, { start: dateRange.from, end: dateRange.to })) return false;
      }
      return true;
    });
  }, [payments, searchTerm, methodFilter, statusFilter, dateRange]);

  const todayTotal = filteredPayments.filter((p: any) => new Date(p.payment_date).toDateString() === new Date().toDateString()).reduce((sum: number, p: any) => sum + p.amount, 0);
  const monthTotal = filteredPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
  const completedTotal = filteredPayments.filter((p: any) => p.status === 'completed').reduce((sum: number, p: any) => sum + p.amount, 0);
  const pendingTotal = filteredPayments.filter((p: any) => p.status === 'pending').reduce((sum: number, p: any) => sum + p.amount, 0);

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = { cash: 'bg-green-500/10 text-green-500', card: 'bg-blue-500/10 text-blue-500', upi: 'bg-purple-500/10 text-purple-500', wallet: 'bg-amber-500/10 text-amber-500', bank_transfer: 'bg-cyan-500/10 text-cyan-500', online: 'bg-indigo-500/10 text-indigo-500' };
    return colors[method] || 'bg-muted text-muted-foreground';
  };
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = { completed: 'bg-green-500/10 text-green-500', pending: 'bg-yellow-500/10 text-yellow-500', failed: 'bg-red-500/10 text-red-500', refunded: 'bg-orange-500/10 text-orange-500' };
    return colors[status] || 'bg-muted text-muted-foreground';
  };
  const clearFilters = () => { setSearchTerm(''); setMethodFilter('all'); setStatusFilter('all'); setDateRange(undefined); };
  const hasActiveFilters = searchTerm || methodFilter !== 'all' || statusFilter !== 'all' || dateRange;

  const exportToCSV = () => {
    const headers = ['Date', 'Member', 'Amount', 'Method', 'Status', 'Invoice'];
    const rows = filteredPayments.map((p: any) => [format(new Date(p.payment_date), 'dd/MM/yyyy HH:mm'), p.members?.profiles?.full_name || 'Walk-in', p.amount, p.payment_method, p.status, p.invoices?.invoice_number || '-']);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `payments-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">Payments</h1>
          <Button variant="outline" size="sm" onClick={exportToCSV}><Download className="h-4 w-4 mr-2" />Export</Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4" />Filters</CardTitle>
              {hasActiveFilters && (<Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-4 w-4 mr-1" />Clear All</Button>)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search member, code, or invoice..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" /></div>
              <DateRangeFilter onChange={(range) => setDateRange(range || undefined)} />
              <Select value={methodFilter} onValueChange={setMethodFilter}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Payment Method" /></SelectTrigger><SelectContent><SelectItem value="all">All Methods</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="wallet">Wallet</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="online">Online</SelectItem></SelectContent></Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="refunded">Refunded</SelectItem></SelectContent></Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard title="Today's Collection" value={`₹${todayTotal.toLocaleString()}`} icon={CreditCard} variant="accent" />
          <StatCard title="Filtered Total" value={`₹${monthTotal.toLocaleString()}`} icon={TrendingUp} variant="success" />
          <StatCard title="Completed" value={`₹${completedTotal.toLocaleString()}`} icon={Receipt} variant="default" />
          <StatCard title="Pending" value={`₹${pendingTotal.toLocaleString()}`} icon={Wallet} variant="info" />
        </div>

        <Card>
          <CardHeader><CardTitle>{hasActiveFilters ? `Filtered Payments (${filteredPayments.length})` : `Recent Payments (${payments.length})`}</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (<div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>) : (
              <Table>
                <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead>Invoice</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredPayments.map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell><div className="flex flex-col"><span className="font-medium">{payment.members?.profiles?.full_name || 'Walk-in'}</span>{payment.members?.member_code && <span className="text-xs text-muted-foreground">{payment.members.member_code}</span>}</div></TableCell>
                      <TableCell className="font-medium">₹{payment.amount.toLocaleString()}</TableCell>
                      <TableCell><Badge className={getMethodColor(payment.payment_method)}>{payment.payment_method}</Badge></TableCell>
                      <TableCell><Badge className={getStatusColor(payment.status)}>{payment.status}</Badge></TableCell>
                      <TableCell className="font-mono text-sm">{payment.invoices?.invoice_number || '-'}</TableCell>
                      <TableCell>{format(new Date(payment.payment_date), 'dd MMM yyyy HH:mm')}</TableCell>
                    </TableRow>
                  ))}
                  {filteredPayments.length === 0 && (<TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{hasActiveFilters ? 'No payments match your filters' : 'No payments found'}</TableCell></TableRow>)}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
