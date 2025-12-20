import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchMembership,
  fetchMemberMemberships,
  fetchActiveMembership,
  purchaseMembership,
  activateMembership,
  requestFreeze,
  approveFreeze,
  resumeFromFreeze,
  addFreeDays,
} from '@/services/membershipService';
import type { PurchaseRequest, FreezeRequest } from '@/types/membership';

export function useMembership(membershipId: string) {
  return useQuery({
    queryKey: ['membership', membershipId],
    queryFn: () => fetchMembership(membershipId),
    enabled: !!membershipId,
  });
}

export function useMemberMemberships(memberId: string) {
  return useQuery({
    queryKey: ['memberMemberships', memberId],
    queryFn: () => fetchMemberMemberships(memberId),
    enabled: !!memberId,
  });
}

export function useActiveMembership(memberId: string) {
  return useQuery({
    queryKey: ['activeMembership', memberId],
    queryFn: () => fetchActiveMembership(memberId),
    enabled: !!memberId,
  });
}

export function usePurchaseMembership() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: PurchaseRequest) => purchaseMembership(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['memberMemberships', variables.memberId] });
      queryClient.invalidateQueries({ queryKey: ['activeMembership', variables.memberId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useActivateMembership() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: activateMembership,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership'] });
      queryClient.invalidateQueries({ queryKey: ['memberMemberships'] });
      queryClient.invalidateQueries({ queryKey: ['activeMembership'] });
    },
  });
}

export function useRequestFreeze() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: FreezeRequest) => requestFreeze(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership'] });
      queryClient.invalidateQueries({ queryKey: ['approvalRequests'] });
    },
  });
}

export function useApproveFreeze() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ freezeId, approvedBy }: { freezeId: string; approvedBy: string }) =>
      approveFreeze(freezeId, approvedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership'] });
      queryClient.invalidateQueries({ queryKey: ['approvalRequests'] });
    },
  });
}

export function useResumeFromFreeze() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: resumeFromFreeze,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership'] });
      queryClient.invalidateQueries({ queryKey: ['memberMemberships'] });
      queryClient.invalidateQueries({ queryKey: ['activeMembership'] });
    },
  });
}

export function useAddFreeDays() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ membershipId, days, reason, addedBy }: { 
      membershipId: string; 
      days: number; 
      reason: string; 
      addedBy: string 
    }) => addFreeDays(membershipId, days, reason, addedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership'] });
      queryClient.invalidateQueries({ queryKey: ['memberMemberships'] });
    },
  });
}