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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CreditCard, Wallet, TrendingUp, Receipt, Search, Download, Filter, X, Ban, Plus, AlertTriangle, ChevronDown, Send } from 'lucide-react';
import { AddExpenseDrawer } from '@/components/finance/AddExpenseDrawer';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranchContext } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { recordPayment as unifiedRecordPayment, voidPayment as unifiedVoidPayment } from '@/services/billingService';
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
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ member_search: '', amount: '', payment_method: 'cash', notes: '' });
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [duesOpen, setDuesOpen] = useState(true);

  const isAdminOrOwner = roles?.some((r: any) => ['admin', 'owner'].includes(typeof r === 'string' ? r : r?.role));

  const { data: memberSearchResults = [] } = useQuery({
    queryKey: ['member-search-payment', paymentForm.member_search, branchFilter],
    enabled: paymentForm.member_search.length >= 2,
    queryFn: async () => {
      const { data } = await supabase.rpc('search_members', {
        search_term: paymentForm.member_search,
        p_branch_id: branchFilter || undefined,
        p_limit: 5,
      });
      return data || [];
    },
  });

  // Fetch overdue invoices for selected member in Record Payment drawer
  const { data: memberInvoices = [] } = useQuery({
    queryKey: ['member-overdue-invoices', selectedMember?.id],
    enabled: !!selectedMember?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, amount_paid, status, due_date, invoice_type, created_at')
        .eq('member_id', selectedMember.id)
        .in('status', ['pending', 'partial', 'overdue'])
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all overdue/partial invoices for Dues Collection card
  const { data: overdueInvoices = [] } = useQuery({
    queryKey: ['all-overdue-invoices', branchFilter],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select(`
          id, invoice_number, total_amount, amount_paid, status, due_date, invoice_type, member_id,
          members(member_code, profiles:user_id(full_name, phone))
        `)
        .in('status', ['pending', 'partial', 'overdue'])
        .order('due_date', { ascending: true })
        .limit(50);
      if (branchFilter) query = query.eq('branch_id', branchFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const totalDues = overdueInvoices.reduce((sum: number, inv: any) => sum + ((inv.total_amount || 0) - (inv.amount_paid || 0)), 0);

  const recordPaymentMutation = useMutation({
    mutationFn: async (form: { memberId: string; amount: number; method: string; notes: string; invoiceId?: string }) => {
      if (!form.invoiceId) {
        // Standalone payment without invoice — direct insert
        const { error } = await (supabase.from('payments') as any).insert({
          member_id: form.memberId,
          branch_id: branchFilter!,
          amount: form.amount,
          payment_method: form.method,
          status: 'completed',
          payment_date: new Date().toISOString(),
        });
        if (error) throw error;
        return;
      }
      // Use unified RPC for invoice-linked payments
      await unifiedRecordPayment({
        branchId: branchFilter!,
        invoiceId: form.invoiceId,
        memberId: form.memberId,
        amount: form.amount,
        paymentMethod: form.method,
        notes: form.notes || undefined,
        receivedBy: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['all-overdue-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['member-overdue-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Payment recorded successfully');
      setRecordPaymentOpen(false);
      setPaymentForm({ member_search: '', amount: '', payment_method: 'cash', notes: '' });
      setSelectedMember(null);
      setSelectedInvoice(null);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to record payment'),
  });

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

  const handleCollectFromDues = (invoice: any) => {
    setSelectedMember({
      id: invoice.member_id,
      full_name: invoice.members?.profiles?.full_name || 'Unknown',
      member_code: invoice.members?.member_code || '',
    });
    setSelectedInvoice(invoice);
    setPaymentForm(f => ({
      ...f,
      amount: String((invoice.total_amount || 0) - (invoice.amount_paid || 0)),
      member_search: '',
    }));
    setRecordPaymentOpen(true);
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddExpenseOpen(true)} className="rounded-xl"><Receipt className="h-4 w-4 mr-2" />Add Expense</Button>
            <Button size="sm" onClick={() => setRecordPaymentOpen(true)} className="rounded-xl shadow-lg shadow-primary/20"><CreditCard className="h-4 w-4 mr-2" />Record Payment</Button>
            <Button variant="outline" size="sm" onClick={exportToCSV} className="rounded-xl"><Download className="h-4 w-4 mr-2" />Export</Button>
          </div>
        </div>

        {/* Dues Collection Card */}
        {overdueInvoices.length > 0 && (
          <Collapsible open={duesOpen} onOpenChange={setDuesOpen}>
            <Card className="rounded-2xl border-warning/30 bg-warning/5">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-warning/10 transition-colors rounded-t-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-warning/20">
                        <AlertTriangle className="h-5 w-5 text-warning" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Dues Collection</CardTitle>
                        <p className="text-sm text-muted-foreground">{overdueInvoices.length} pending invoices • Total: ₹{totalDues.toLocaleString()}</p>
                      </div>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${duesOpen ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Due Amount</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overdueInvoices.map((inv: any) => {
                          const dueAmount = (inv.total_amount || 0) - (inv.amount_paid || 0);
                          const isOverdue = inv.due_date && new Date(inv.due_date) < new Date();
                          return (
                            <TableRow key={inv.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{inv.members?.profiles?.full_name || 'Unknown'}</p>
                                  <p className="text-xs text-muted-foreground">{inv.members?.member_code}</p>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                              <TableCell className="font-semibold text-destructive">₹{dueAmount.toLocaleString()}</TableCell>
                              <TableCell>
                                {inv.due_date ? (
                                  <span className={isOverdue ? 'text-destructive font-medium' : ''}>
                                    {format(new Date(inv.due_date), 'dd MMM')}
                                  </span>
                                ) : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge className={`border ${
                                  inv.status === 'overdue' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                                  inv.status === 'partial' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                                  'bg-warning/10 text-warning border-warning/20'
                                }`}>
                                  {inv.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleCollectFromDues(inv)}>
                                  <CreditCard className="h-3 w-3" />Collect
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

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

      {/* Record Payment Drawer */}
      <Sheet open={recordPaymentOpen} onOpenChange={(open) => {
        setRecordPaymentOpen(open);
        if (!open) { setSelectedMember(null); setSelectedInvoice(null); }
      }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Record Payment</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Search Member</Label>
              <Input
                placeholder="Name, phone, or code..."
                value={selectedMember ? selectedMember.full_name : paymentForm.member_search}
                onChange={(e) => {
                  setSelectedMember(null);
                  setSelectedInvoice(null);
                  setPaymentForm(f => ({ ...f, member_search: e.target.value, amount: '' }));
                }}
              />
              {!selectedMember && memberSearchResults.length > 0 && paymentForm.member_search.length >= 2 && (
                <div className="border rounded-lg mt-1 max-h-40 overflow-y-auto">
                  {memberSearchResults.map((m: any) => (
                    <div key={m.id} className="p-2 hover:bg-muted cursor-pointer text-sm" onClick={() => { setSelectedMember(m); setPaymentForm(f => ({ ...f, member_search: '' })); setSelectedInvoice(null); }}>
                      <span className="font-medium">{m.full_name}</span> <span className="text-muted-foreground">({m.member_code})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Show member's overdue invoices */}
            {selectedMember && memberInvoices.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Pending Invoices
                </Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {memberInvoices.map((inv: any) => {
                    const dueAmount = (inv.total_amount || 0) - (inv.amount_paid || 0);
                    const isSelected = selectedInvoice?.id === inv.id;
                    return (
                      <div
                        key={inv.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => {
                          setSelectedInvoice(inv);
                          setPaymentForm(f => ({ ...f, amount: String(dueAmount) }));
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-mono text-sm font-medium">{inv.invoice_number}</p>
                            <p className="text-xs text-muted-foreground capitalize">{(inv.invoice_type || 'manual').replace('_', ' ')}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-destructive">₹{dueAmount.toLocaleString()}</p>
                            <Badge className={`text-[10px] ${
                              inv.status === 'overdue' ? 'bg-destructive/10 text-destructive' :
                              inv.status === 'partial' ? 'bg-amber-500/10 text-amber-600' :
                              'bg-warning/10 text-warning'
                            }`}>
                              {inv.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedMember && memberInvoices.length === 0 && (
              <p className="text-sm text-success flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success inline-block" />
                No pending dues for this member
              </p>
            )}

            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" placeholder="0" value={paymentForm.amount} onChange={(e) => setPaymentForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={paymentForm.payment_method} onValueChange={(v) => setPaymentForm(f => ({ ...f, payment_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea placeholder="Optional notes..." value={paymentForm.notes} onChange={(e) => setPaymentForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <SheetFooter>
            <Button
              className="w-full"
              disabled={!selectedMember || !paymentForm.amount || recordPaymentMutation.isPending}
              onClick={() => recordPaymentMutation.mutate({
                memberId: selectedMember.id,
                amount: parseFloat(paymentForm.amount),
                method: paymentForm.payment_method,
                notes: paymentForm.notes,
                invoiceId: selectedInvoice?.id,
              })}
            >
              <CreditCard className="h-4 w-4 mr-2" /> Record Payment
              {selectedInvoice && <span className="ml-1 text-xs opacity-75">→ {selectedInvoice.invoice_number}</span>}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Add Expense Drawer */}
      {branchFilter && <AddExpenseDrawer open={addExpenseOpen} onOpenChange={setAddExpenseOpen} branchId={branchFilter} />}
    </AppLayout>
  );
}
