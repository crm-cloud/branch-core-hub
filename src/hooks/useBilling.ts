import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchInvoice,
  fetchMemberInvoices,
  fetchBranchInvoices,
  createManualInvoice,
  updateInvoiceStatus,
  recordPayment,
  fetchPayments,
} from '@/services/billingService';
import type { InvoiceStatus, PaymentMethod } from '@/types/membership';

export function useInvoice(invoiceId: string) {
  return useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => fetchInvoice(invoiceId),
    enabled: !!invoiceId,
  });
}

export function useMemberInvoices(memberId: string) {
  return useQuery({
    queryKey: ['memberInvoices', memberId],
    queryFn: () => fetchMemberInvoices(memberId),
    enabled: !!memberId,
  });
}

export function useBranchInvoices(branchId: string, status?: InvoiceStatus) {
  return useQuery({
    queryKey: ['branchInvoices', branchId, status],
    queryFn: () => fetchBranchInvoices(branchId, status),
    enabled: !!branchId,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createManualInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branchInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['memberInvoices'] });
    },
  });
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ invoiceId, status }: { invoiceId: string; status: InvoiceStatus }) =>
      updateInvoiceStatus(invoiceId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['branchInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['memberInvoices'] });
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: recordPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      queryClient.invalidateQueries({ queryKey: ['branchInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['memberInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['membership'] });
      queryClient.invalidateQueries({ queryKey: ['activeMembership'] });
    },
  });
}

export function usePayments(branchId: string, filters?: { memberId?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['payments', branchId, filters],
    queryFn: () => fetchPayments(branchId, filters),
    enabled: !!branchId,
  });
}