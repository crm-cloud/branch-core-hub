import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard } from '@/components/ui/stat-card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CreditCard, Wallet, TrendingUp, Receipt, Search, Download, Filter, X, Ban, RotateCcw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranchContext } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useMemo } from 'react';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { toast } from 'sonner';

export default function PaymentsPage() {
  const { branchFilter } = useBranchContext();
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>(undefined);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidingPayment, setVoidingPayment] = useState<any>(null);
  const [voidReason, setVoidReason] = useState('');

  const isAdminOrOwner = roles?.some((r: any) => ['admin', 'owner'].includes(typeof r === 'string' ? r : r?.role));

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

  const voidPaymentMutation = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      const { error } = await (supabase.from('payments') as any)
        .update({
          status: 'voided',
          void_reason: reason,
          voided_by: user?.id,
          voided_at: new Date().toISOString(),
        })
        .eq('id', paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment voided successfully');
      setVoidDialogOpen(false);
      setVoidingPayment(null);
      setVoidReason('');
    },
    onError: () => toast.error('Failed to void payment'),
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

  const todayTotal = filteredPayments.filter((p: any) => p.status !== 'voided' && new Date(p.payment_date).toDateString() === new Date().toDateString()).reduce((sum: number, p: any) => sum + p.amount, 0);
  const monthTotal = filteredPayments.filter((p: any) => p.status !== 'voided').reduce((sum: number, p: any) => sum + p.amount, 0);
  const completedTotal = filteredPayments.filter((p: any) => p.status === 'completed').reduce((sum: number, p: any) => sum + p.amount, 0);
  const pendingTotal = filteredPayments.filter((p: any) => p.status === 'pending').reduce((sum: number, p: any) => sum + p.amount, 0);

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = { cash: 'bg-emerald-500/10 text-emerald-600', card: 'bg-sky-500/10 text-sky-600', upi: 'bg-violet-500/10 text-violet-600', wallet: 'bg-amber-500/10 text-amber-600', bank_transfer: 'bg-cyan-500/10 text-cyan-600', online: 'bg-indigo-500/10 text-indigo-600' };
    return colors[method] || 'bg-muted text-muted-foreground';
  };
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = { completed: 'bg-emerald-500/10 text-emerald-600', pending: 'bg-amber-500/10 text-amber-600', failed: 'bg-destructive/10 text-destructive', refunded: 'bg-orange-500/10 text-orange-600', voided: 'bg-destructive/10 text-destructive line-through' };
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
    const a = document.createElement('a'); a.href = url; a.download = `payments-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
    window.URL.revokeObjectURL(url);
  };

  const openVoidDialog = (payment: any) => {
    setVoidingPayment(payment);
    setVoidReason('');
    setVoidDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white">
                <CreditCard className="h-6 w-6" />
              </div>
              Payments
            </h1>
            <p className="text-muted-foreground mt-1">Track and manage all payment transactions</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportToCSV} className="rounded-xl"><Download className="h-4 w-4 mr-2" />Export</Button>
        </div>

        <Card className="rounded-2xl border-border/50 shadow-lg shadow-slate-200/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4" />Filters</CardTitle>
              {hasActiveFilters && (<Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-4 w-4 mr-1" />Clear All</Button>)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search member, code, or invoice..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 rounded-xl" /></div>
              <DateRangeFilter onChange={(range) => setDateRange(range || undefined)} />
              <Select value={methodFilter} onValueChange={setMethodFilter}><SelectTrigger className="w-[150px] rounded-xl"><SelectValue placeholder="Method" /></SelectTrigger><SelectContent><SelectItem value="all">All Methods</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="wallet">Wallet</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="online">Online</SelectItem></SelectContent></Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[150px] rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="refunded">Refunded</SelectItem><SelectItem value="voided">Voided</SelectItem></SelectContent></Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard title="Today's Collection" value={`₹${todayTotal.toLocaleString()}`} icon={CreditCard} variant="accent" />
          <StatCard title="Filtered Total" value={`₹${monthTotal.toLocaleString()}`} icon={TrendingUp} variant="success" />
          <StatCard title="Completed" value={`₹${completedTotal.toLocaleString()}`} icon={Receipt} variant="default" />
          <StatCard title="Pending" value={`₹${pendingTotal.toLocaleString()}`} icon={Wallet} variant="info" />
        </div>

        <Card className="rounded-2xl border-border/50 shadow-lg">
          <CardHeader><CardTitle>{hasActiveFilters ? `Filtered Payments (${filteredPayments.length})` : `Recent Payments (${payments.length})`}</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (<div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>) : (
              <Table>
                <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead>Invoice</TableHead><TableHead>Date</TableHead>{isAdminOrOwner && <TableHead>Actions</TableHead>}</TableRow></TableHeader>
                <TableBody>
                  {filteredPayments.map((payment: any) => {
                    const isVoided = payment.status === 'voided';
                    return (
                      <TableRow key={payment.id} className={isVoided ? 'opacity-50' : ''}>
                        <TableCell><div className="flex flex-col"><span className={`font-medium ${isVoided ? 'line-through' : ''}`}>{payment.members?.profiles?.full_name || 'Walk-in'}</span>{payment.members?.member_code && <span className="text-xs text-muted-foreground">{payment.members.member_code}</span>}</div></TableCell>
                        <TableCell className={`font-medium ${isVoided ? 'line-through' : ''}`}>₹{payment.amount.toLocaleString()}</TableCell>
                        <TableCell><Badge className={getMethodColor(payment.payment_method)}>{payment.payment_method}</Badge></TableCell>
                        <TableCell><Badge className={getStatusColor(payment.status)}>{payment.status}</Badge></TableCell>
                        <TableCell className="font-mono text-sm">{payment.invoices?.invoice_number || '-'}</TableCell>
                        <TableCell>{format(new Date(payment.payment_date), 'dd MMM yyyy HH:mm')}</TableCell>
                        {isAdminOrOwner && (
                          <TableCell>
                            {!isVoided && payment.status !== 'failed' && (
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => openVoidDialog(payment)}>
                                <Ban className="h-4 w-4 mr-1" /> Void
                              </Button>
                            )}
                            {isVoided && payment.void_reason && (
                              <span className="text-xs text-muted-foreground italic">Reason: {payment.void_reason}</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {filteredPayments.length === 0 && (<TableRow><TableCell colSpan={isAdminOrOwner ? 7 : 6} className="text-center py-8 text-muted-foreground">{hasActiveFilters ? 'No payments match your filters' : 'No payments found'}</TableCell></TableRow>)}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Void Payment Confirmation */}
      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Payment</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the payment of ₹{voidingPayment?.amount?.toLocaleString()} as voided. This action cannot be undone. The original record will be preserved for audit purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <Label>Reason for voiding <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Enter the reason for voiding this payment (e.g., duplicate entry, incorrect amount)"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!voidReason.trim() || voidPaymentMutation.isPending}
              onClick={() => voidPaymentMutation.mutate({ paymentId: voidingPayment?.id, reason: voidReason })}
            >
              <Ban className="h-4 w-4 mr-1" /> Void Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
