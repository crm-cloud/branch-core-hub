import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPTPackages,
  createPTPackage,
  purchasePTPackage,
  fetchMemberPTPackages,
  fetchActiveMemberPackages,
  schedulePTSession,
  fetchTrainerSessions,
  completePTSession,
  cancelPTSession,
  generateFitnessPlan,
} from "@/services/ptService";
import type { Database } from "@/integrations/supabase/types";

type PTPackageInsert = Database["public"]["Tables"]["pt_packages"]["Insert"];

export function usePTPackages(branchId: string) {
  return useQuery({
    queryKey: ["pt-packages", branchId],
    queryFn: () => fetchPTPackages(branchId),
    enabled: !!branchId,
  });
}

export function useMemberPTPackages(memberId: string) {
  return useQuery({
    queryKey: ["member-pt-packages", memberId],
    queryFn: () => fetchMemberPTPackages(memberId),
    enabled: !!memberId,
  });
}

export function useActiveMemberPackages(branchId: string) {
  return useQuery({
    queryKey: ["active-member-packages", branchId],
    queryFn: () => fetchActiveMemberPackages(branchId),
    enabled: !!branchId,
  });
}

export function useTrainerSessions(
  trainerId: string,
  options?: { startDate?: Date; endDate?: Date }
) {
  return useQuery({
    queryKey: ["trainer-sessions", trainerId, options],
    queryFn: () => fetchTrainerSessions(trainerId, options),
    enabled: !!trainerId,
  });
}

export function useCreatePTPackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PTPackageInsert) => createPTPackage(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pt-packages", variables.branch_id] });
    },
  });
}

export function usePurchasePTPackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberId,
      packageId,
      trainerId,
      branchId,
      pricePaid,
    }: {
      memberId: string;
      packageId: string;
      trainerId: string;
      branchId: string;
      pricePaid: number;
    }) => purchasePTPackage(memberId, packageId, trainerId, branchId, pricePaid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-pt-packages"] });
      queryClient.invalidateQueries({ queryKey: ["active-member-packages"] });
    },
  });
}

export function useSchedulePTSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberPackageId,
      trainerId,
      branchId,
      scheduledAt,
      durationMinutes,
    }: {
      memberPackageId: string;
      trainerId: string;
      branchId: string;
      scheduledAt: Date;
      durationMinutes?: number;
    }) => schedulePTSession(memberPackageId, trainerId, branchId, scheduledAt, durationMinutes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainer-sessions"] });
    },
  });
}

export function useCompletePTSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, notes }: { sessionId: string; notes?: string }) =>
      completePTSession(sessionId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainer-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["member-pt-packages"] });
    },
  });
}

export function useCancelPTSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, reason }: { sessionId: string; reason: string }) =>
      cancelPTSession(sessionId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainer-sessions"] });
    },
  });
}

export function useGenerateFitnessPlan() {
  return useMutation({
    mutationFn: ({
      type,
      memberInfo,
      options,
    }: {
      type: "workout" | "diet";
      memberInfo: {
        name?: string;
        age?: number;
        gender?: string;
        height?: number;
        weight?: number;
        fitnessGoals?: string;
        healthConditions?: string;
        experience?: string;
        preferences?: string;
      };
      options?: { durationWeeks?: number; caloriesTarget?: number };
    }) => generateFitnessPlan(type, memberInfo, options),
  });
}
