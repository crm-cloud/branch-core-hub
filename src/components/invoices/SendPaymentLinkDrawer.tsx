import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { IndianRupee, MessageSquare, Mail, Link2, Copy, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SendPaymentLinkDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: {
    id: string;
    invoice_number: string;
    total_amount: number;
    amount_paid: number;
    member_name?: string;
    member_phone?: string;
    member_email?: string;
  } | null;
}

export function SendPaymentLinkDrawer({ open, onOpenChange, invoice }: SendPaymentLinkDrawerProps) {
  const [paymentType, setPaymentType] = useState<'full' | 'partial' | 'due'>('due');
  const [customAmount, setCustomAmount] = useState('');
  const [copied, setCopied] = useState(false);

  if (!invoice) return null;

  const dueAmount = invoice.total_amount - (invoice.amount_paid || 0);

  const getPaymentAmount = () => {
    switch (paymentType) {
      case 'full': return invoice.total_amount;
      case 'due': return dueAmount;
      case 'partial': return parseFloat(customAmount) || 0;
    }
  };

  const paymentAmount = getPaymentAmount();

  // Build a payment link using the published app URL
  const paymentLink = `${window.location.origin}/member/pay?invoice=${invoice.id}&amount=${paymentAmount}`;

  const getMessage = () => {
    return `Hi ${invoice.member_name || 'Member'},\n\nYour invoice *${invoice.invoice_number}* has a ${paymentType === 'due' ? 'pending balance' : 'payment'} of *₹${paymentAmount.toLocaleString()}*.\n\nPay securely here:\n${paymentLink}\n\nThank you!`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentLink);
    setCopied(true);
    toast.success('Payment link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    if (!invoice.member_phone) {
      toast.error('No phone number available for this member');
      return;
    }
    const phone = invoice.member_phone.replace(/[^0-9]/g, '');
    const formattedPhone = phone.startsWith('91') ? phone : `91${phone}`;
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(getMessage())}`, '_blank');
  };

  const handleSendEmail = () => {
    if (!invoice.member_email) {
      toast.error('No email available for this member');
      return;
    }
    const subject = `Payment Link - Invoice ${invoice.invoice_number}`;
    window.open(`mailto:${invoice.member_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(getMessage())}`, '_blank');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Send Payment Link
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Invoice Summary */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Invoice</span>
                <span className="font-mono font-medium">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Member</span>
                <span>{invoice.member_name || 'Walk-in'}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span>₹{invoice.total_amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-success">
                <span>Paid</span>
                <span>₹{(invoice.amount_paid || 0).toLocaleString()}</span>
              </div>
              {dueAmount > 0 && (
                <div className="flex justify-between text-sm font-medium text-destructive">
                  <span>Due</span>
                  <span>₹{dueAmount.toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Amount Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Payment Amount</Label>
            <RadioGroup value={paymentType} onValueChange={(v) => setPaymentType(v as any)} className="space-y-2">
              {dueAmount > 0 && dueAmount < invoice.total_amount && (
                <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="due" id="due" />
                  <Label htmlFor="due" className="flex-1 cursor-pointer flex justify-between">
                    <span>Due Amount</span>
                    <Badge variant="outline">₹{dueAmount.toLocaleString()}</Badge>
                  </Label>
                </div>
              )}
              <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="full" id="full" />
                <Label htmlFor="full" className="flex-1 cursor-pointer flex justify-between">
                  <span>Full Amount</span>
                  <Badge variant="outline">₹{invoice.total_amount.toLocaleString()}</Badge>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="partial" id="partial" />
                <Label htmlFor="partial" className="cursor-pointer">Custom Amount</Label>
              </div>
            </RadioGroup>
            {paymentType === 'partial' && (
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  min="1"
                  max={dueAmount > 0 ? dueAmount : invoice.total_amount}
                />
              </div>
            )}
          </div>

          {/* Payment Link Preview */}
          {paymentAmount > 0 && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Payment Link</span>
                  <Badge className="bg-primary/10 text-primary">₹{paymentAmount.toLocaleString()}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Input value={paymentLink} readOnly className="text-xs font-mono" />
                  <Button variant="outline" size="icon" onClick={handleCopyLink}>
                    {copied ? <CheckCircle className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Send Actions */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Send Via</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col gap-2"
                onClick={handleSendWhatsApp}
                disabled={paymentAmount <= 0}
              >
                <MessageSquare className="h-5 w-5 text-green-600" />
                <span className="text-xs">WhatsApp</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col gap-2"
                onClick={handleSendEmail}
                disabled={paymentAmount <= 0}
              >
                <Mail className="h-5 w-5 text-blue-600" />
                <span className="text-xs">Email</span>
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
