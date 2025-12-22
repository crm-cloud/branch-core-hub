import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BranchSelector } from '@/components/dashboard/BranchSelector';
import { CreateInvoiceDrawer } from '@/components/invoices/CreateInvoiceDrawer';
import { FileText, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranches } from '@/hooks/useBranches';

export default function InvoicesPage() {
  const [createOpen, setCreateOpen] = useState(false);
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
          members(member_code, profiles:user_id(full_name))
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (branchFilter) {
        query = query.eq('branch_id', branchFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      paid: 'bg-green-500/10 text-green-500',
      pending: 'bg-yellow-500/10 text-yellow-500',
      partial: 'bg-blue-500/10 text-blue-500',
      overdue: 'bg-destructive/10 text-destructive',
      cancelled: 'bg-muted text-muted-foreground',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Invoices</h1>
          <div className="flex items-center gap-3">
            <BranchSelector
              branches={branches}
              selectedBranch={selectedBranch}
              onBranchChange={setSelectedBranch}
              showAllOption={true}
            />
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Invoice
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice: any) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono">{invoice.invoice_number}</span>
                        </div>
                      </TableCell>
                      <TableCell>{invoice.members?.profiles?.full_name || 'Walk-in'}</TableCell>
                      <TableCell className="font-medium">₹{invoice.total_amount.toLocaleString()}</TableCell>
                      <TableCell>₹{(invoice.amount_paid || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(invoice.status)}>{invoice.status}</Badge>
                      </TableCell>
                      <TableCell>{new Date(invoice.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                  {invoices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No invoices found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateInvoiceDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        branchId={selectedBranch !== 'all' ? selectedBranch : branches[0]?.id || ''}
      />
    </AppLayout>
  );
}
