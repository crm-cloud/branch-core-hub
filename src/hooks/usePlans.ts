import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPlans, fetchPlan, createPlan, updatePlan, deletePlan, updatePlanBenefits } from '@/services/planService';
import type { BenefitType, FrequencyType } from '@/types/membership';

export function usePlans(branchId?: string, includeInactive = false) {
  return useQuery({
    queryKey: ['plans', branchId, includeInactive],
    queryFn: () => fetchPlans(branchId, includeInactive),
  });
}

export function usePlan(planId: string) {
  return useQuery({
    queryKey: ['plan', planId],
    queryFn: () => fetchPlan(planId),
    enabled: !!planId,
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ planId, data }: { planId: string; data: Parameters<typeof updatePlan>[1] }) =>
      updatePlan(planId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan', variables.planId] });
    },
  });
}

export function useUpdatePlanBenefits() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ planId, benefits }: { 
      planId: string; 
      benefits: { benefit_type: BenefitType; frequency: FrequencyType; limit_count?: number; description?: string }[] 
    }) => updatePlanBenefits(planId, benefits),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan', variables.planId] });
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deletePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}