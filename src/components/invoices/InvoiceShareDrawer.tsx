import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useState } from 'react';
import { toast } from 'sonner';
import { Mail, MessageCircle, Copy, Printer, Download, Send, Phone } from 'lucide-react';
import { format } from 'date-fns';

interface InvoiceShareDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
}

export function InvoiceShareDrawer({ open, onOpenChange, invoice }: InvoiceShareDrawerProps) {
  const [email, setEmail] = useState(invoice?.members?.profiles?.email || '');
  const [phone, setPhone] = useState(invoice?.members?.profiles?.phone || '');
  
  if (!invoice) return null;

  const memberProfile = (invoice.members as any)?.profiles;
  const memberName = memberProfile?.full_name || 'Customer';

  // WhatsApp message template
  const whatsappMessage = `*Invoice from Incline Fitness*

Dear ${memberName},

Your invoice #${invoice.invoice_number} is ready.

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

Please find your invoice details below:

Invoice Number: ${invoice.invoice_number}
Date: ${format(new Date(invoice.created_at), 'dd MMMM yyyy')}
Amount: ₹${invoice.total_amount.toLocaleString()}
${invoice.amount_paid ? `Amount Paid: ₹${invoice.amount_paid.toLocaleString()}` : ''}
${invoice.total_amount - (invoice.amount_paid || 0) > 0 ? `Balance Due: ₹${(invoice.total_amount - (invoice.amount_paid || 0)).toLocaleString()}` : 'Status: Paid in Full'}

Thank you for choosing Incline Fitness!

Best regards,
Team Incline Fitness`;

  const handleWhatsAppShare = () => {
    const formattedPhone = phone.replace(/\D/g, '');
    const phoneNumber = formattedPhone.startsWith('91') ? formattedPhone : `91${formattedPhone}`;
    const encodedMessage = encodeURIComponent(whatsappMessage);
    window.open(`https://wa.me/${phoneNumber}?text=${encodedMessage}`, '_blank');
    toast.success('Opening WhatsApp...');
  };

  const handleEmailShare = () => {
    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailtoLink;
    toast.success('Opening email client...');
  };

  const handleSMSShare = () => {
    const smsLink = `sms:${phone}?body=${encodeURIComponent(smsMessage)}`;
    window.location.href = smsLink;
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
            <p><strong>${memberName}</strong></p>
            <p>${memberProfile?.email || ''}</p>
            <p>${memberProfile?.phone || ''}</p>
          </div>
          <div style="text-align: right;">
            <h3>Invoice Details:</h3>
            <p><strong>${invoice.invoice_number}</strong></p>
            <p>Date: ${format(new Date(invoice.created_at), 'dd MMM yyyy')}</p>
            <p>
              <span class="status ${invoice.status === 'paid' ? 'paid' : 'pending'}">
                ${invoice.status.toUpperCase()}
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
                <td>${item.description}</td>
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
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone number"
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
              disabled={!phone}
            >
              <MessageCircle className="h-5 w-5" />
              Send via WhatsApp
            </Button>

            <Button 
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={handleEmailShare}
              disabled={!email}
            >
              <Mail className="h-5 w-5" />
              Send via Email
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
