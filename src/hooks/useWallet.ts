import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchWallet,
  fetchWalletTransactions,
  creditWallet,
  debitWallet,
  payWithWallet,
  getOrCreateWallet,
} from '@/services/walletService';

export function useWallet(memberId: string) {
  return useQuery({
    queryKey: ['wallet', memberId],
    queryFn: () => fetchWallet(memberId),
    enabled: !!memberId,
  });
}

export function useWalletTransactions(walletId: string) {
  return useQuery({
    queryKey: ['walletTransactions', walletId],
    queryFn: () => fetchWalletTransactions(walletId),
    enabled: !!walletId,
  });
}

export function useGetOrCreateWallet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: getOrCreateWallet,
    onSuccess: (_, memberId) => {
      queryClient.invalidateQueries({ queryKey: ['wallet', memberId] });
    },
  });
}

export function useCreditWallet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ memberId, amount, description, referenceType, referenceId, createdBy }: {
      memberId: string;
      amount: number;
      description: string;
      referenceType?: string;
      referenceId?: string;
      createdBy?: string;
    }) => creditWallet(memberId, amount, description, referenceType, referenceId, createdBy),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wallet', variables.memberId] });
      queryClient.invalidateQueries({ queryKey: ['walletTransactions'] });
    },
  });
}

export function useDebitWallet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ memberId, amount, description, referenceType, referenceId, createdBy }: {
      memberId: string;
      amount: number;
      description: string;
      referenceType?: string;
      referenceId?: string;
      createdBy?: string;
    }) => debitWallet(memberId, amount, description, referenceType, referenceId, createdBy),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wallet', variables.memberId] });
      queryClient.invalidateQueries({ queryKey: ['walletTransactions'] });
    },
  });
}

export function usePayWithWallet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ memberId, invoiceId, amount, createdBy }: {
      memberId: string;
      invoiceId: string;
      amount: number;
      createdBy?: string;
    }) => payWithWallet(memberId, invoiceId, amount, createdBy),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wallet', variables.memberId] });
      queryClient.invalidateQueries({ queryKey: ['walletTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['memberInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['branchInvoices'] });
    },
  });
}