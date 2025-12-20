import { supabase } from '@/integrations/supabase/client';
import type { InvoiceStatus, PaymentMethod } from '@/types/membership';

export async function fetchInvoice(invoiceId: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      invoice_items(*)
    `)
    .eq('id', invoiceId)
    .single();

  if (error) throw error;
  return data;
}

export async function fetchMemberInvoices(memberId: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function fetchBranchInvoices(branchId: string, status?: InvoiceStatus) {
  let query = supabase
    .from('invoices')
    .select(`
      *,
      invoice_items(*)
    `)
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createManualInvoice(invoice: {
  branchId: string;
  memberId?: string;
  items: { description: string; quantity: number; unitPrice: number }[];
  notes?: string;
  dueDate?: string;
}) {
  const subtotal = invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const { data: newInvoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      branch_id: invoice.branchId,
      member_id: invoice.memberId,
      invoice_number: '', // Auto-generated
      subtotal,
      tax_amount: 0,
      total_amount: subtotal,
      status: 'pending' as InvoiceStatus,
      due_date: invoice.dueDate,
      notes: invoice.notes,
    })
    .select()
    .single();

  if (invoiceError) throw invoiceError;

  const invoiceItems = invoice.items.map(item => ({
    invoice_id: newInvoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total_amount: item.quantity * item.unitPrice,
  }));

  const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItems);
  if (itemsError) throw itemsError;

  return fetchInvoice(newInvoice.id);
}

export async function updateInvoiceStatus(invoiceId: string, status: InvoiceStatus) {
  const { data, error } = await supabase
    .from('invoices')
    .update({ status })
    .eq('id', invoiceId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function recordPayment(payment: {
  branchId: string;
  invoiceId?: string;
  memberId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionId?: string;
  notes?: string;
  receivedBy?: string;
}) {
  const { data: newPayment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      branch_id: payment.branchId,
      invoice_id: payment.invoiceId,
      member_id: payment.memberId,
      amount: payment.amount,
      payment_method: payment.paymentMethod,
      transaction_id: payment.transactionId,
      notes: payment.notes,
      received_by: payment.receivedBy,
      status: 'completed',
    })
    .select()
    .single();

  if (paymentError) throw paymentError;

  // Update invoice if linked
  if (payment.invoiceId) {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('total_amount, amount_paid')
      .eq('id', payment.invoiceId)
      .single();

    if (invoice) {
      const newAmountPaid = (invoice.amount_paid || 0) + payment.amount;
      const isPaid = newAmountPaid >= invoice.total_amount;
      const newStatus: InvoiceStatus = isPaid ? 'paid' : 'partial';

      await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
        })
        .eq('id', payment.invoiceId);

      // If fully paid and linked to membership, activate it
      if (isPaid) {
        const { data: items } = await supabase
          .from('invoice_items')
          .select('reference_type, reference_id')
          .eq('invoice_id', payment.invoiceId)
          .eq('reference_type', 'membership');

        if (items && items.length > 0) {
          for (const item of items) {
            if (item.reference_id) {
              await supabase
                .from('memberships')
                .update({ status: 'active' })
                .eq('id', item.reference_id);
            }
          }
        }
      }
    }
  }

  return newPayment;
}

export async function fetchPayments(branchId: string, filters?: { memberId?: string; startDate?: string; endDate?: string }) {
  let query = supabase
    .from('payments')
    .select('*')
    .eq('branch_id', branchId)
    .order('payment_date', { ascending: false });

  if (filters?.memberId) {
    query = query.eq('member_id', filters.memberId);
  }

  if (filters?.startDate) {
    query = query.gte('payment_date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('payment_date', filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}