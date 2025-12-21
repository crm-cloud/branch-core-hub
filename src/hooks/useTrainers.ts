import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchTrainers,
  getTrainer,
  createTrainer,
  updateTrainer,
  deactivateTrainer,
  fetchTrainerClasses,
  checkTrainerAvailability,
} from "@/services/trainerService";
import type { Database } from "@/integrations/supabase/types";

type TrainerInsert = Database["public"]["Tables"]["trainers"]["Insert"];

export function useTrainers(branchId: string, activeOnly = true) {
  return useQuery({
    queryKey: ["trainers", branchId, activeOnly],
    queryFn: () => fetchTrainers(branchId, activeOnly),
    enabled: !!branchId,
  });
}

export function useTrainer(trainerId: string) {
  return useQuery({
    queryKey: ["trainer", trainerId],
    queryFn: () => getTrainer(trainerId),
    enabled: !!trainerId,
  });
}

export function useTrainerClasses(
  trainerId: string,
  options?: { startDate?: Date; endDate?: Date }
) {
  return useQuery({
    queryKey: ["trainer-classes", trainerId, options],
    queryFn: () => fetchTrainerClasses(trainerId, options),
    enabled: !!trainerId,
  });
}

export function useCreateTrainer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TrainerInsert) => createTrainer(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["trainers", variables.branch_id] });
    },
  });
}

export function useUpdateTrainer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ trainerId, updates }: { trainerId: string; updates: Partial<TrainerInsert> }) =>
      updateTrainer(trainerId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainers"] });
      queryClient.invalidateQueries({ queryKey: ["trainer"] });
    },
  });
}

export function useDeactivateTrainer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (trainerId: string) => deactivateTrainer(trainerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainers"] });
    },
  });
}

export function useCheckTrainerAvailability() {
  return useMutation({
    mutationFn: ({
      trainerId,
      scheduledAt,
      durationMinutes,
      excludeClassId,
    }: {
      trainerId: string;
      scheduledAt: Date;
      durationMinutes: number;
      excludeClassId?: string;
    }) => checkTrainerAvailability(trainerId, scheduledAt, durationMinutes, excludeClassId),
  });
}
