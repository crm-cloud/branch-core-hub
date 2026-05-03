import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, MessageCircle, Copy, Printer, Download, Send, Phone, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { communicationService } from '@/services/communicationService';
import { e } from '@/utils/htmlEscape';
import { supabase } from '@/integrations/supabase/client';
import { buildInvoicePdf, type InvoicePdfInput } from '@/utils/pdfBlob';
import { blobToBase64 } from '@/utils/uploadAttachment';
import { sendWhatsAppDocument } from '@/utils/whatsappDocumentSender';
import { findTemplate, resolveTemplate } from '@/lib/templates/dynamicAttachment';
import { format as fmtDate } from 'date-fns';

interface InvoiceShareDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
}

export function InvoiceShareDrawer({ open, onOpenChange, invoice: invoiceProp }: InvoiceShareDrawerProps) {
  const [email, setEmail] = useState(invoiceProp?.members?.profiles?.email || '');
  const [phone, setPhone] = useState(invoiceProp?.members?.profiles?.phone || '');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Always fetch the full invoice (with branch + items) when the drawer opens so
  // the generated PDF has every field, regardless of how the caller queried.
  const { data: fullInvoice } = useQuery({
    queryKey: ['invoice-share-detail', invoiceProp?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          members(member_code, profiles:user_id(full_name, email, phone)),
          branch:branch_id(name, address, phone, email, gstin),
          invoice_items(*)
        `)
        .eq('id', invoiceProp.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!invoiceProp?.id && open,
  });

  if (!invoiceProp) return null;
  const invoice: any = fullInvoice || invoiceProp;

  const memberProfile = (invoice.members as any)?.profiles;
  const memberName = memberProfile?.full_name || 'Customer';
  const branch = (invoice as any).branch || (invoice as any).branches || {};

  // WhatsApp message template
  const whatsappMessage = `*Invoice from Incline Fitness*

Dear ${memberName},

Your invoice #${invoice.invoice_number} is ready. PDF attached.

📋 *Invoice Details*
Amount: ₹${invoice.total_amount.toLocaleString()}
${invoice.amount_paid ? `Paid: ₹${invoice.amount_paid.toLocaleString()}` : ''}
${invoice.total_amount - (invoice.amount_paid || 0) > 0 ? `Balance Due: ₹${(invoice.total_amount - (invoice.amount_paid || 0)).toLocaleString()}` : '✅ Paid in Full'}
Date: ${format(new Date(invoice.created_at), 'dd MMM yyyy')}

Thank you for your business!
Team Incline Fitness`;

  // SMS message template
  const smsMessage = `Incline Fitness: Invoice #${invoice.invoice_number} for ₹${invoice.total_amount.toLocaleString()}. ${invoice.total_amount - (invoice.amount_paid || 0) > 0 ? `Due: ₹${(invoice.total_amount - (invoice.amount_paid || 0)).toLocaleString()}` : 'Paid'}. Thank you!`;

  // Email template
  const emailSubject = `Invoice #${invoice.invoice_number} from Incline Fitness`;
  const emailBody = `Dear ${memberName},

Please find your invoice details below (PDF attached):

Invoice Number: ${invoice.invoice_number}
Date: ${format(new Date(invoice.created_at), 'dd MMMM yyyy')}
Amount: ₹${invoice.total_amount.toLocaleString()}
${invoice.amount_paid ? `Amount Paid: ₹${invoice.amount_paid.toLocaleString()}` : ''}
${invoice.total_amount - (invoice.amount_paid || 0) > 0 ? `Balance Due: ₹${(invoice.total_amount - (invoice.amount_paid || 0)).toLocaleString()}` : 'Status: Paid in Full'}

Thank you for choosing Incline Fitness!

Best regards,
Team Incline Fitness`;

  // Map the invoice row to the PDF builder input. Pulls items, branch, and
  // member contact details so the generated PDF matches the on-screen invoice.
  const buildPdfInput = (): InvoicePdfInput => ({
    invoice_number: invoice.invoice_number,
    created_at: invoice.created_at,
    due_date: invoice.due_date,
    status: invoice.status,
    subtotal: Number(invoice.subtotal || 0),
    discount_amount: Number(invoice.discount_amount || 0),
    tax_amount: Number(invoice.tax_amount || 0),
    gst_rate: Number(invoice.gst_rate || 0),
    total_amount: Number(invoice.total_amount || 0),
    amount_paid: Number(invoice.amount_paid || 0),
    notes: invoice.notes,
    is_gst_invoice: invoice.is_gst_invoice,
    customer_gstin: invoice.customer_gstin,
    items: (invoice.invoice_items || []).map((it: any) => ({
      description: it.description,
      quantity: Number(it.quantity || 1),
      unit_price: Number(it.unit_price || 0),
      total_amount: Number(it.total_amount || 0),
      hsn_code: it.hsn_code,
    })),
    member_name: memberName,
    member_code: (invoice.members as any)?.member_code,
    member_email: memberProfile?.email,
    member_phone: memberProfile?.phone,
    branch_name: branch.name || 'Incline Fitness',
    branch_address: branch.address,
    branch_phone: branch.phone,
    branch_email: branch.email,
    gst_number: branch.gstin,
  });

  const handleWhatsAppShare = async () => {
    if (!invoice.branch_id) {
      toast.error('Branch context missing — cannot send via WhatsApp');
      return;
    }
    setSendingWhatsApp(true);
    try {
      const pdf = buildInvoicePdf(buildPdfInput());
      const result = await sendWhatsAppDocument({
        branchId: invoice.branch_id,
        phone,
        memberId: invoice.member_id,
        caption: whatsappMessage,
        filename: `Invoice-${invoice.invoice_number}.pdf`,
        pdf,
        folder: 'invoices',
        dedupeKey: `invoice:${invoice.id}:wa`,
        category: 'payment_receipt',
      });
      if (result.status === 'deduped') {
        toast.info('This invoice was already sent on WhatsApp.');
      } else {
        toast.success(result.fallback ? 'WhatsApp opened with PDF link (fallback)' : 'Invoice PDF sent via WhatsApp');
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error('Invoice WhatsApp share failed:', err);
      toast.error(err?.message || 'Failed to send invoice');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const handleEmailShare = async () => {
    setSendingEmail(true);
    try {
      const pdf = buildInvoicePdf(buildPdfInput());
      const base64 = await blobToBase64(pdf);
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: email,
          subject: emailSubject,
          html: `<p>${emailBody.replace(/\n/g, '<br>')}</p>`,
          branch_id: invoice.branch_id,
          attachments: [{
            filename: `Invoice-${invoice.invoice_number}.pdf`,
            content_base64: base64,
            content_type: 'application/pdf',
          }],
        },
      });
      if (error) throw error;
      toast.success('Invoice email sent with PDF attached');
      onOpenChange(false);
    } catch (err: any) {
      console.error('Invoice email share failed:', err);
      toast.error(err?.message || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };


  const handleSMSShare = async () => {
    await communicationService.sendSMS(phone, smsMessage, {
      branchId: invoice.branch_id,
      memberId: invoice.member_id,
    });
    toast.success('Opening SMS...');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(whatsappMessage);
    toast.success('Invoice details copied to clipboard!');
  };

  const handlePrint = () => {
    // Open print dialog
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoice.invoice_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { margin: 0; color: #333; }
          .header p { margin: 5px 0; color: #666; }
          .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .invoice-info div { flex: 1; }
          .invoice-info h3 { margin: 0 0 10px 0; color: #333; font-size: 14px; }
          .invoice-info p { margin: 3px 0; color: #666; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #f5f5f5; font-weight: 600; }
          .totals { text-align: right; }
          .totals p { margin: 5px 0; }
          .totals .total { font-size: 18px; font-weight: bold; color: #333; }
          .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
          .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 500; }
          .status.paid { background: #d4edda; color: #155724; }
          .status.pending { background: #fff3cd; color: #856404; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>INCLINE FITNESS</h1>
          <p>Tax Invoice</p>
        </div>
        
        <div class="invoice-info">
          <div>
            <h3>Bill To:</h3>
            <p><strong>${e(memberName)}</strong></p>
            <p>${e(memberProfile?.email || '')}</p>
            <p>${e(memberProfile?.phone || '')}</p>
          </div>
          <div style="text-align: right;">
            <h3>Invoice Details:</h3>
            <p><strong>${e(invoice.invoice_number)}</strong></p>
            <p>Date: ${format(new Date(invoice.created_at), 'dd MMM yyyy')}</p>
            <p>
              <span class="status ${invoice.status === 'paid' ? 'paid' : 'pending'}">
                ${e(String(invoice.status).toUpperCase())}
              </span>
            </p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.invoice_items?.map((item: any) => `
              <tr>
                <td>${e(item.description)}</td>
                <td>${item.quantity || 1}</td>
                <td>₹${item.unit_price.toLocaleString()}</td>
                <td>₹${item.total_amount.toLocaleString()}</td>
              </tr>
            `).join('') || '<tr><td colspan="4">No items</td></tr>'}
          </tbody>
        </table>

        <div class="totals">
          <p>Subtotal: ₹${invoice.subtotal.toLocaleString()}</p>
          ${invoice.discount_amount ? `<p>Discount: -₹${invoice.discount_amount.toLocaleString()}</p>` : ''}
          ${invoice.tax_amount ? `<p>Tax: ₹${invoice.tax_amount.toLocaleString()}</p>` : ''}
          <p class="total">Total: ₹${invoice.total_amount.toLocaleString()}</p>
          ${invoice.amount_paid ? `<p style="color: green;">Paid: ₹${invoice.amount_paid.toLocaleString()}</p>` : ''}
          ${invoice.total_amount - (invoice.amount_paid || 0) > 0 ? `<p style="color: red;">Balance Due: ₹${(invoice.total_amount - (invoice.amount_paid || 0)).toLocaleString()}</p>` : ''}
        </div>

        <div class="footer">
          <p>Thank you for your business!</p>
          <p>Incline Fitness | Contact us for any queries</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Share Invoice</SheetTitle>
          <SheetDescription>
            Send invoice #{invoice.invoice_number} to customer
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Invoice Summary */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-mono text-sm">{invoice.invoice_number}</p>
                  <p className="text-lg font-bold">₹{invoice.total_amount.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{memberName}</p>
                  <p className={`text-sm font-medium ${invoice.status === 'paid' ? 'text-green-500' : 'text-yellow-500'}`}>
                    {invoice.status.toUpperCase()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <PhoneInput
                value={phone}
                onChange={(value) => setPhone(value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
              />
            </div>
          </div>

          {/* Share Options */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Share via</p>
            
            <Button 
              className="w-full justify-start gap-3 bg-green-600 hover:bg-green-700"
              onClick={handleWhatsAppShare}
              disabled={!phone || sendingWhatsApp}
            >
              <MessageCircle className="h-5 w-5" />
              {sendingWhatsApp ? 'Generating PDF & sending…' : 'Send PDF via WhatsApp'}
            </Button>

            <Button 
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={handleEmailShare}
              disabled={!email || sendingEmail}
            >
              <Mail className="h-5 w-5" />
              {sendingEmail ? 'Generating PDF & sending…' : 'Send PDF via Email'}
            </Button>

            <Button 
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={handleSMSShare}
              disabled={!phone}
            >
              <Phone className="h-5 w-5" />
              Send via SMS
            </Button>

            <div className="border-t pt-3 mt-3 space-y-3">
              <Button 
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={handleCopyLink}
              >
                <Copy className="h-5 w-5" />
                Copy Invoice Details
              </Button>

              <Button 
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={handlePrint}
              >
                <Printer className="h-5 w-5" />
                Print Invoice
              </Button>
            </div>
          </div>

          {/* WhatsApp Preview */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Message Preview</p>
            <Textarea
              value={whatsappMessage}
              readOnly
              rows={8}
              className="text-xs font-mono bg-muted/30"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
