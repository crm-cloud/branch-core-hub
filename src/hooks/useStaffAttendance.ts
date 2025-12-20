import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staffAttendanceService } from '@/services/staffAttendanceService';
import { useToast } from '@/hooks/use-toast';

export function useStaffAttendance(branchId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const todayAttendance = useQuery({
    queryKey: ['staff-attendance', 'today', branchId],
    queryFn: () => staffAttendanceService.getTodayAttendance(branchId!),
    enabled: !!branchId,
    refetchInterval: 30000,
  });

  const checkedInStaff = useQuery({
    queryKey: ['staff-attendance', 'checked-in', branchId],
    queryFn: () => staffAttendanceService.getCheckedInStaff(branchId!),
    enabled: !!branchId,
    refetchInterval: 30000,
  });

  const employees = useQuery({
    queryKey: ['employees', branchId],
    queryFn: () => staffAttendanceService.getBranchEmployees(branchId!),
    enabled: !!branchId,
  });

  const checkInMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      staffAttendanceService.checkIn(userId, branchId!),
    onSuccess: (result) => {
      if (result.success) {
        toast({ title: 'Check-in Successful' });
        queryClient.invalidateQueries({ queryKey: ['staff-attendance'] });
      } else {
        toast({
          title: 'Check-in Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Check-in failed',
        variant: 'destructive',
      });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: (userId: string) => staffAttendanceService.checkOut(userId),
    onSuccess: (result) => {
      if (result.success) {
        const duration = result.duration_minutes || 0;
        toast({
          title: 'Check-out Successful',
          description: `Duration: ${Math.floor(duration / 60)}h ${duration % 60}m`,
        });
        queryClient.invalidateQueries({ queryKey: ['staff-attendance'] });
      } else {
        toast({
          title: 'Check-out Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Check-out failed',
        variant: 'destructive',
      });
    },
  });

  return {
    todayAttendance,
    checkedInStaff,
    employees,
    checkIn: checkInMutation.mutate,
    checkOut: checkOutMutation.mutate,
    isCheckingIn: checkInMutation.isPending,
    isCheckingOut: checkOutMutation.isPending,
  };
}
