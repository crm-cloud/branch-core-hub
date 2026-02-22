import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BranchSelector } from '@/components/dashboard/BranchSelector';
import { CreateInvoiceDrawer } from '@/components/invoices/CreateInvoiceDrawer';
import { InvoiceViewDrawer } from '@/components/invoices/InvoiceViewDrawer';
import { 
  FileText, 
  Plus, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Clock,
  Search,
  MoreHorizontal,
  Eye,
  Download,
  Send
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranches } from '@/hooks/useBranches';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function InvoicesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { data: branches = [] } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  const branchFilter = selectedBranch !== 'all' ? selectedBranch : undefined;

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', branchFilter],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          members(member_code, profiles:user_id(full_name, email)),
          invoice_items(description, reference_type)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (branchFilter) {
        query = query.eq('branch_id', branchFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getInvoiceType = (invoice: any): { label: string; emoji: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' } => {
    if (invoice.pos_sale_id) return { label: 'POS', emoji: '🛒', variant: 'secondary' };
    const items = invoice.invoice_items || [];
    const firstItem = items[0];
    if (!firstItem) return { label: 'Manual', emoji: '📝', variant: 'outline' };
    const refType = firstItem.reference_type || '';
    const desc = (firstItem.description || '').toLowerCase();
    if (refType === 'membership_refund' || invoice.total_amount < 0) return { label: 'Refund', emoji: '↩️', variant: 'destructive' };
    if (desc.includes('top-up') || desc.includes('top up') || desc.includes('add-on')) return { label: 'Add-On', emoji: '➕', variant: 'default' };
    if (refType === 'pt_package' || desc.includes('pt ')) return { label: 'PT', emoji: '🏋️', variant: 'secondary' };
    if (refType === 'membership') return { label: 'Membership', emoji: '📋', variant: 'outline' };
    return { label: 'Manual', emoji: '📝', variant: 'outline' };
  };

  // Filter invoices
  const filteredInvoices = invoices.filter((invoice: any) => {
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    const memberName = invoice.members?.profiles?.full_name || '';
    const matchesSearch = memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Calculate stats
  const stats = {
    totalClients: new Set(invoices.map((i: any) => i.member_id).filter(Boolean)).size,
    totalInvoices: invoices.length,
    paidAmount: invoices.filter((i: any) => i.status === 'paid').reduce((sum: number, i: any) => sum + i.total_amount, 0),
    unpaidAmount: invoices.filter((i: any) => i.status !== 'paid' && i.status !== 'cancelled').reduce((sum: number, i: any) => sum + (i.total_amount - (i.amount_paid || 0)), 0),
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      paid: 'bg-success/10 text-success border-success/20',
      pending: 'bg-warning/10 text-warning border-warning/20',
      partial: 'bg-info/10 text-info border-info/20',
      overdue: 'bg-destructive/10 text-destructive border-destructive/20',
      cancelled: 'bg-muted text-muted-foreground border-border',
    };
    return colors[status] || 'bg-muted text-muted-foreground border-border';
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'W';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Invoices</h1>
            <p className="text-muted-foreground mt-1">Manage and track all invoices</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="bg-accent hover:bg-accent/90">
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        </div>

        {/* Stats Cards - Vuexy Style */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Clients</p>
                  <h3 className="text-3xl font-bold mt-1">{stats.totalClients}</h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-info to-info/80 text-info-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Invoices</p>
                  <h3 className="text-3xl font-bold mt-1">{stats.totalInvoices}</h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <FileText className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-success to-success/80 text-success-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Paid</p>
                  <h3 className="text-3xl font-bold mt-1">₹{stats.paidAmount.toLocaleString()}</h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-warning to-warning/80 text-warning-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Unpaid</p>
                  <h3 className="text-3xl font-bold mt-1">₹{stats.unpaidAmount.toLocaleString()}</h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Clock className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice # or member name..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <BranchSelector
                branches={branches}
                selectedBranch={selectedBranch}
                onBranchChange={setSelectedBranch}
                showAllOption={true}
              />
            </div>
          </CardContent>
        </Card>

        {/* Invoice List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Invoice List</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[250px]">Client</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice: any) => {
                      const memberName = invoice.members?.profiles?.full_name || 'Walk-in Customer';
                      const balance = invoice.total_amount - (invoice.amount_paid || 0);
                      
                      return (
                        <TableRow key={invoice.id} className="group">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-accent/10 text-accent font-semibold">
                                  {getInitials(memberName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{memberName}</p>
                                <p className="text-sm text-muted-foreground">
                                  {invoice.members?.member_code || 'Guest'}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{invoice.invoice_number}</span>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const t = getInvoiceType(invoice);
                              return (
                                <Badge variant={t.variant}>
                                  {t.emoji} {t.label}
                                </Badge>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="font-semibold">
                            ₹{invoice.total_amount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-success">
                            ₹{(invoice.amount_paid || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className={balance > 0 ? 'text-destructive' : ''}>
                            ₹{balance.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(invoice.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${getStatusColor(invoice.status)} border`}>
                              {invoice.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setViewInvoice(invoice)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Download className="mr-2 h-4 w-4" />
                                  Download
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Send className="mr-2 h-4 w-4" />
                                  Send
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredInvoices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No invoices found</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateInvoiceDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        branchId={selectedBranch !== 'all' ? selectedBranch : branches[0]?.id || ''}
      />

      {viewInvoice && (
        <InvoiceViewDrawer
          open={!!viewInvoice}
          onOpenChange={(open) => !open && setViewInvoice(null)}
          invoiceId={viewInvoice.id}
          onRecordPayment={() => {}}
        />
      )}
    </AppLayout>
  );
}
