import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GymLoader } from '@/components/ui/gym-loader';
import { CheckCircle, CreditCard, ExternalLink, AlertCircle, Clock } from 'lucide-react';

interface InvoiceInfo {
  id: string;
  invoice_number: string;
  total_amount: number;
  amount_paid: number;
  status: string;
  due_date: string | null;
  member_name: string;
  branch_name: string;
}

export default function MemberCheckout() {
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('invoice');
  const [invoice, setInvoice] = useState<InvoiceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  // Fetch invoice details
  useEffect(() => {
    if (!invoiceId) {
      setError('No invoice specified. Please use a valid payment link.');
      setLoading(false);
      return;
    }

    const fetchInvoice = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from('invoices')
          .select(`
            id, invoice_number, total_amount, amount_paid, status, due_date,
            members!invoices_member_id_fkey ( user_id, branch_id ),
            branches!invoices_branch_id_fkey ( name )
          `)
          .eq('id', invoiceId)
          .maybeSingle();

        if (fetchErr || !data) {
          setError('Invoice not found. It may have been deleted or the link is invalid.');
          setLoading(false);
          return;
        }

        // Get member name
        let memberName = 'Member';
        const member = data.members as any;
        if (member?.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', member.user_id)
            .maybeSingle();
          if (profile?.full_name) memberName = profile.full_name;
        }

        setInvoice({
          id: data.id,
          invoice_number: data.invoice_number || 'N/A',
          total_amount: data.total_amount,
          amount_paid: data.amount_paid || 0,
          status: data.status || 'pending',
          due_date: data.due_date,
          member_name: memberName,
          branch_name: (data.branches as any)?.name || 'Incline Fitness',
        });
      } catch {
        setError('Failed to load invoice details.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [invoiceId]);

  // Realtime subscription for payment updates
  useEffect(() => {
    if (!invoiceId) return;

    const channel = supabase
      .channel(`checkout-${invoiceId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'invoices',
        filter: `id=eq.${invoiceId}`,
      }, (payload: any) => {
        if (payload.new?.status === 'paid') {
          setInvoice(prev => prev ? { ...prev, status: 'paid', amount_paid: payload.new.amount_paid } : prev);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [invoiceId]);

  // Generate payment link
  const handlePayNow = async () => {
    if (!invoice) return;
    setGeneratingLink(true);

    try {
      // Get branch_id from the invoice
      const { data: inv } = await supabase
        .from('invoices')
        .select('branch_id')
        .eq('id', invoice.id)
        .single();

      if (!inv?.branch_id) throw new Error('Branch not found');

      const balanceDue = invoice.total_amount - invoice.amount_paid;

      const { data, error: fnErr } = await supabase.functions.invoke('create-razorpay-link', {
        body: {
          invoiceId: invoice.id,
          amount: balanceDue,
          branchId: inv.branch_id,
        },
      });

      if (fnErr) throw new Error(fnErr.message || 'Failed to create payment link');

      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsed.error) throw new Error(parsed.error);

      if (parsed.short_url) {
        setPaymentUrl(parsed.short_url);
        // Auto-redirect to Razorpay
        window.location.href = parsed.short_url;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate payment link');
    } finally {
      setGeneratingLink(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <GymLoader text="Loading invoice..." />
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="max-w-md w-full shadow-xl rounded-2xl">
          <CardContent className="flex flex-col items-center py-10 gap-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <h2 className="text-lg font-semibold">Payment Error</h2>
            <p className="text-muted-foreground text-center text-sm">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invoice) return null;

  const balanceDue = invoice.total_amount - invoice.amount_paid;
  const isPaid = invoice.status === 'paid' || balanceDue <= 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="max-w-md w-full shadow-xl rounded-2xl overflow-hidden">
        {/* Brand Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-5">
          <h1 className="text-xl font-bold">Incline Fitness</h1>
          <p className="text-orange-100 text-sm">{invoice.branch_name}</p>
        </div>

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Invoice {invoice.invoice_number}</CardTitle>
            <Badge variant={isPaid ? 'default' : 'secondary'} className={isPaid ? 'bg-green-500 text-white' : ''}>
              {isPaid ? (
                <><CheckCircle className="h-3 w-3 mr-1" /> Paid</>
              ) : (
                <><Clock className="h-3 w-3 mr-1" /> Pending</>
              )}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{invoice.member_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-medium">₹{invoice.total_amount.toLocaleString()}</span>
            </div>
            {invoice.amount_paid > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Paid</span>
                <span className="font-medium text-green-600">₹{invoice.amount_paid.toLocaleString()}</span>
              </div>
            )}
            {!isPaid && (
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Balance Due</span>
                <span className="font-bold text-lg">₹{balanceDue.toLocaleString()}</span>
              </div>
            )}
            {invoice.due_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span>{new Date(invoice.due_date).toLocaleDateString('en-IN')}</span>
              </div>
            )}
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Action */}
          {isPaid ? (
            <div className="text-center py-4">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-green-700">Payment Received</h3>
              <p className="text-muted-foreground text-sm">Thank you! Your payment has been confirmed.</p>
            </div>
          ) : (
            <>
              <Button
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                onClick={handlePayNow}
                disabled={generatingLink}
              >
                {generatingLink ? (
                  <>Generating Payment Link...</>
                ) : (
                  <><CreditCard className="h-5 w-5 mr-2" /> Pay ₹{balanceDue.toLocaleString()}</>
                )}
              </Button>
              {paymentUrl && (
                <a
                  href={paymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open payment page manually
                </a>
              )}
            </>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Secured by Razorpay • 256-bit encryption
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
