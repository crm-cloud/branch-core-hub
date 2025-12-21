import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard } from '@/components/ui/stat-card';
import { BranchSelector } from '@/components/dashboard/BranchSelector';
import { CreditCard, Wallet, TrendingUp, Receipt } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranches } from '@/hooks/useBranches';
import { useState } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';

export default function PaymentsPage() {
  const { data: branches = [] } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const branchFilter = selectedBranch !== 'all' ? selectedBranch : undefined;

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments', branchFilter],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select(`
          *,
          members(member_code, profiles:user_id(full_name)),
          invoices(invoice_number)
        `)
        .order('payment_date', { ascending: false })
        .limit(50);
      
      if (branchFilter) query = query.eq('branch_id', branchFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const todayTotal = payments
    .filter((p: any) => new Date(p.payment_date).toDateString() === new Date().toDateString())
    .reduce((sum: number, p: any) => sum + p.amount, 0);

  const monthTotal = payments.reduce((sum: number, p: any) => sum + p.amount, 0);

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      cash: 'bg-success/10 text-success',
      card: 'bg-info/10 text-info',
      upi: 'bg-accent/10 text-accent',
      wallet: 'bg-warning/10 text-warning',
      bank_transfer: 'bg-primary/10 text-primary',
    };
    return colors[method] || 'bg-muted text-muted-foreground';
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">Payments</h1>
          <BranchSelector
            branches={branches}
            selectedBranch={selectedBranch}
            onBranchChange={setSelectedBranch}
            showAllOption={true}
          />
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard title="Today's Collection" value={`₹${todayTotal.toLocaleString()}`} icon={CreditCard} variant="accent" />
          <StatCard title="This Month" value={`₹${monthTotal.toLocaleString()}`} icon={TrendingUp} variant="success" />
          <StatCard title="Total Transactions" value={payments.length} icon={Receipt} variant="default" />
          <StatCard title="Avg Transaction" value={`₹${payments.length ? Math.round(monthTotal / payments.length).toLocaleString() : 0}`} icon={Wallet} variant="info" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
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
                    <TableHead>Member</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          {payment.members?.profiles?.full_name || 'Walk-in'}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">₹{payment.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={getMethodColor(payment.payment_method)}>{payment.payment_method}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{payment.invoices?.invoice_number || '-'}</TableCell>
                      <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No payments found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
