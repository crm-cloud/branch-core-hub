import { supabase } from '@/integrations/supabase/client';
import { recordPayment as unifiedRecordPayment } from '@/services/billingService';

export interface PaymentGatewayConfig {
  provider: 'razorpay' | 'phonepe' | 'ccavenue' | 'payu';
  isActive: boolean;
  config: Record<string, any>;
}

export interface PaymentOrder {
  orderId: string;
  amount: number;
  currency: string;
  invoiceId: string;
  gateway: string;
  gatewayOrderId?: string;
  checkoutUrl?: string;
  razorpayKey?: string;
}

// Fetch active payment gateway (global setting, not branch-specific)
export async function fetchActiveGateway(branchId: string): Promise<PaymentGatewayConfig | null> {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('*')
    .eq('integration_type', 'payment_gateway')
    .eq('is_active', true)
    .or(`branch_id.is.null,branch_id.eq.${branchId}`)
    .order('branch_id', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    provider: data.provider as PaymentGatewayConfig['provider'],
    isActive: data.is_active ?? false,
    config: (data.config as Record<string, any>) || {},
  };
}

// Initialize a payment order
export async function initializePayment(
  invoiceId: string,
  gateway: string,
  branchId: string
): Promise<PaymentOrder> {
  const { data, error } = await supabase.functions.invoke('create-payment-order', {
    body: {
      invoiceId,
      gateway,
      branchId,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to create payment order');
  }

  return data as PaymentOrder;
}

// Verify payment status
export async function verifyPayment(
  transactionId: string,
  gateway: string,
  paymentData: Record<string, any>
): Promise<{ success: boolean; status: string; message?: string }> {
  const { data, error } = await supabase.functions.invoke('verify-payment', {
    body: {
      transactionId,
      gateway,
      paymentData,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to verify payment');
  }

  return data;
}

/**
 * Record a manual/cash payment.
 * Delegates to the unified record_payment RPC via billingService.
 */
export async function recordManualPayment(
  invoiceId: string,
  amount: number,
  paymentMethod: 'cash' | 'card' | 'upi' | 'bank_transfer',
  notes?: string
): Promise<{ success: boolean }> {
  // Get invoice details for branch_id and member_id
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('branch_id, member_id')
    .eq('id', invoiceId)
    .single();

  if (invoiceError) throw invoiceError;

  await unifiedRecordPayment({
    branchId: invoice.branch_id,
    invoiceId,
    memberId: invoice.member_id || undefined,
    amount,
    paymentMethod,
    notes,
  });

  return { success: true };
}

// Load Razorpay SDK dynamically
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// Open Razorpay checkout
export async function openRazorpayCheckout(
  order: PaymentOrder,
  memberInfo: { name: string; email: string; phone: string },
  onSuccess: (response: any) => void,
  onError: (error: any) => void
): Promise<void> {
  const loaded = await loadRazorpayScript();
  if (!loaded) {
    onError(new Error('Failed to load Razorpay SDK'));
    return;
  }

  const options = {
    key: order.razorpayKey,
    amount: order.amount * 100, // in paise
    currency: order.currency || 'INR',
    name: 'Gym Membership',
    description: `Invoice Payment - ${order.invoiceId}`,
    order_id: order.gatewayOrderId,
    prefill: {
      name: memberInfo.name,
      email: memberInfo.email,
      contact: memberInfo.phone,
    },
    handler: function (response: any) {
      onSuccess({
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_signature: response.razorpay_signature,
      });
    },
    modal: {
      ondismiss: function () {
        onError(new Error('Payment cancelled by user'));
      },
    },
    theme: {
      color: '#f97316', // Orange accent
    },
  };

  const rzp = new (window as any).Razorpay(options);
  rzp.on('payment.failed', function (response: any) {
    onError(new Error(response.error.description || 'Payment failed'));
  });
  rzp.open();
}
