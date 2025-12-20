import { supabase } from '@/integrations/supabase/client';
import type { Wallet, WalletTransaction, WalletTxnType } from '@/types/membership';

export async function fetchWallet(memberId: string) {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('member_id', memberId)
    .maybeSingle();

  if (error) throw error;
  return data as Wallet | null;
}

export async function createWallet(memberId: string) {
  const { data, error } = await supabase
    .from('wallets')
    .insert({
      member_id: memberId,
      balance: 0,
      total_credited: 0,
      total_debited: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Wallet;
}

export async function getOrCreateWallet(memberId: string) {
  const wallet = await fetchWallet(memberId);
  if (wallet) return wallet;
  return createWallet(memberId);
}

export async function fetchWalletTransactions(walletId: string, limit = 50) {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('wallet_id', walletId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as WalletTransaction[];
}

export async function creditWallet(
  memberId: string,
  amount: number,
  description: string,
  referenceType?: string,
  referenceId?: string,
  createdBy?: string
) {
  const wallet = await getOrCreateWallet(memberId);
  const newBalance = wallet.balance + amount;

  // Create transaction
  const { error: txnError } = await supabase
    .from('wallet_transactions')
    .insert({
      wallet_id: wallet.id,
      txn_type: 'credit' as WalletTxnType,
      amount,
      balance_after: newBalance,
      description,
      reference_type: referenceType,
      reference_id: referenceId,
      created_by: createdBy,
    });

  if (txnError) throw txnError;

  // Update wallet balance
  const { data, error: updateError } = await supabase
    .from('wallets')
    .update({
      balance: newBalance,
      total_credited: (wallet.total_credited || 0) + amount,
    })
    .eq('id', wallet.id)
    .select()
    .single();

  if (updateError) throw updateError;
  return data as Wallet;
}

export async function debitWallet(
  memberId: string,
  amount: number,
  description: string,
  referenceType?: string,
  referenceId?: string,
  createdBy?: string
) {
  const wallet = await fetchWallet(memberId);
  
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  if (wallet.balance < amount) {
    throw new Error('Insufficient wallet balance');
  }

  const newBalance = wallet.balance - amount;

  // Create transaction
  const { error: txnError } = await supabase
    .from('wallet_transactions')
    .insert({
      wallet_id: wallet.id,
      txn_type: 'debit' as WalletTxnType,
      amount,
      balance_after: newBalance,
      description,
      reference_type: referenceType,
      reference_id: referenceId,
      created_by: createdBy,
    });

  if (txnError) throw txnError;

  // Update wallet balance
  const { data, error: updateError } = await supabase
    .from('wallets')
    .update({
      balance: newBalance,
      total_debited: (wallet.total_debited || 0) + amount,
    })
    .eq('id', wallet.id)
    .select()
    .single();

  if (updateError) throw updateError;
  return data as Wallet;
}

export async function payWithWallet(
  memberId: string,
  invoiceId: string,
  amount: number,
  createdBy?: string
) {
  // Debit from wallet
  await debitWallet(
    memberId,
    amount,
    'Payment for invoice',
    'invoice',
    invoiceId,
    createdBy
  );

  // Record as payment
  const { data: invoice } = await supabase
    .from('invoices')
    .select('branch_id')
    .eq('id', invoiceId)
    .single();

  if (!invoice) throw new Error('Invoice not found');

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      branch_id: invoice.branch_id,
      invoice_id: invoiceId,
      member_id: memberId,
      amount,
      payment_method: 'wallet' as any,
      status: 'completed',
      received_by: createdBy,
    })
    .select()
    .single();

  if (paymentError) throw paymentError;

  // Update invoice
  const { data: currentInvoice } = await supabase
    .from('invoices')
    .select('total_amount, amount_paid')
    .eq('id', invoiceId)
    .single();

  if (currentInvoice) {
    const newAmountPaid = (currentInvoice.amount_paid || 0) + amount;
    const isPaid = newAmountPaid >= currentInvoice.total_amount;

    await supabase
      .from('invoices')
      .update({
        amount_paid: newAmountPaid,
        status: isPaid ? 'paid' : 'partial',
      })
      .eq('id', invoiceId);
  }

  return payment;
}