import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchClasses,
  createClass,
  updateClass,
  bookClass,
  addToWaitlist,
  cancelBooking,
  markAttendance,
  fetchClassBookings,
  fetchClassWaitlist,
} from "@/services/classService";
import type { Database } from "@/integrations/supabase/types";

type ClassInsert = Database["public"]["Tables"]["classes"]["Insert"];

export function useClasses(
  branchId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    trainerId?: string;
    activeOnly?: boolean;
  }
) {
  return useQuery({
    queryKey: ["classes", branchId, options],
    queryFn: () => fetchClasses(branchId, options),
    enabled: !!branchId,
  });
}

export function useClassBookings(classId: string) {
  return useQuery({
    queryKey: ["class-bookings", classId],
    queryFn: () => fetchClassBookings(classId),
    enabled: !!classId,
  });
}

export function useClassWaitlist(classId: string) {
  return useQuery({
    queryKey: ["class-waitlist", classId],
    queryFn: () => fetchClassWaitlist(classId),
    enabled: !!classId,
  });
}

export function useCreateClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ClassInsert) => createClass(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["classes", variables.branch_id] });
    },
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ classId, updates }: { classId: string; updates: Partial<ClassInsert> }) =>
      updateClass(classId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}

export function useBookClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ classId, memberId }: { classId: string; memberId: string }) =>
      bookClass(classId, memberId),
    onSuccess: (_, { classId }) => {
      queryClient.invalidateQueries({ queryKey: ["class-bookings", classId] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}

export function useAddToWaitlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ classId, memberId }: { classId: string; memberId: string }) =>
      addToWaitlist(classId, memberId),
    onSuccess: (_, { classId }) => {
      queryClient.invalidateQueries({ queryKey: ["class-waitlist", classId] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      cancelBooking(bookingId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["class-waitlist"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, attended }: { bookingId: string; attended: boolean }) =>
      markAttendance(bookingId, attended),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-bookings"] });
    },
  });
}
