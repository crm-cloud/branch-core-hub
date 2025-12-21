import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { FileText, Printer, Download, IndianRupee, CreditCard } from 'lucide-react';

interface InvoiceViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
  onRecordPayment: () => void;
}

export function InvoiceViewDrawer({ open, onOpenChange, invoiceId, onRecordPayment }: InvoiceViewDrawerProps) {
  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice-details', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          members(member_code, profiles:user_id(full_name, email, phone)),
          branch:branch_id(name, address, phone, email),
          invoice_items(*)
        `)
        .eq('id', invoiceId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!invoiceId && open,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['invoice-payments', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!invoiceId && open,
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      paid: 'bg-success/10 text-success',
      pending: 'bg-warning/10 text-warning',
      partial: 'bg-blue-500/10 text-blue-500',
      overdue: 'bg-destructive/10 text-destructive',
      cancelled: 'bg-muted text-muted-foreground',
    };
    return colors[status] || 'bg-muted';
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading || !invoice) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl">
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const memberProfile = (invoice.members as any)?.profiles;
  const dueAmount = invoice.total_amount - (invoice.amount_paid || 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice Details
            </SheetTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6 print:space-y-4">
          {/* Invoice Header */}
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold font-mono">{invoice.invoice_number}</h2>
              <p className="text-sm text-muted-foreground">
                Date: {format(new Date(invoice.created_at), 'dd MMM yyyy')}
              </p>
              {invoice.due_date && (
                <p className="text-sm text-muted-foreground">
                  Due: {format(new Date(invoice.due_date), 'dd MMM yyyy')}
                </p>
              )}
            </div>
            <Badge className={`${getStatusColor(invoice.status)} text-sm px-3 py-1`}>
              {invoice.status}
            </Badge>
          </div>

          <Separator />

          {/* Bill To / From */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">From</p>
                <p className="font-medium">{invoice.branch?.name}</p>
                <p className="text-sm text-muted-foreground">{invoice.branch?.address}</p>
                <p className="text-sm text-muted-foreground">{invoice.branch?.phone}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Bill To</p>
                <p className="font-medium">{memberProfile?.full_name || 'Walk-in'}</p>
                <p className="text-sm text-muted-foreground">{memberProfile?.email}</p>
                <p className="text-sm text-muted-foreground">{memberProfile?.phone}</p>
                {invoice.members?.member_code && (
                  <p className="text-xs font-mono text-muted-foreground mt-1">{invoice.members.member_code}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Line Items */}
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.invoice_items?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity || 1}</TableCell>
                      <TableCell className="text-right">₹{item.unit_price.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{item.total_amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Totals */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{invoice.subtotal.toLocaleString()}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-success">
                  <span>Discount</span>
                  <span>-₹{invoice.discount_amount.toLocaleString()}</span>
                </div>
              )}
              {invoice.tax_amount > 0 && (
                <div className="flex justify-between">
                  <span>GST</span>
                  <span>₹{invoice.tax_amount.toLocaleString()}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="flex items-center">
                  <IndianRupee className="h-4 w-4" />
                  {invoice.total_amount.toLocaleString()}
                </span>
              </div>
              {invoice.amount_paid > 0 && (
                <div className="flex justify-between text-success">
                  <span>Paid</span>
                  <span>₹{invoice.amount_paid.toLocaleString()}</span>
                </div>
              )}
              {dueAmount > 0 && (
                <div className="flex justify-between text-destructive font-medium">
                  <span>Balance Due</span>
                  <span>₹{dueAmount.toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment History */}
          {payments.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <h4 className="font-medium mb-3">Payment History</h4>
                <div className="space-y-2">
                  {payments.map((payment: any) => (
                    <div key={payment.id} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize">{payment.payment_method}</span>
                        <span className="text-muted-foreground">
                          • {format(new Date(payment.payment_date), 'dd MMM yyyy')}
                        </span>
                      </div>
                      <span className="font-medium text-success">₹{payment.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {invoice.notes && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {dueAmount > 0 && (
            <Button className="w-full" onClick={() => { onOpenChange(false); onRecordPayment(); }}>
              <CreditCard className="h-4 w-4 mr-2" />
              Record Payment (₹{dueAmount.toLocaleString()} due)
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
