import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lockerService } from '@/services/lockerService';
import { useToast } from '@/hooks/use-toast';

export function useLockers(branchId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const lockers = useQuery({
    queryKey: ['lockers', branchId],
    queryFn: () => lockerService.getLockers(branchId!),
    enabled: !!branchId,
  });

  const availableLockers = useQuery({
    queryKey: ['lockers', 'available', branchId],
    queryFn: () => lockerService.getAvailableLockers(branchId!),
    enabled: !!branchId,
  });

  const createLockerMutation = useMutation({
    mutationFn: (locker: Parameters<typeof lockerService.createLocker>[0]) =>
      lockerService.createLocker(locker),
    onSuccess: () => {
      toast({ title: 'Locker Created' });
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create locker',
        variant: 'destructive',
      });
    },
  });

  const assignLockerMutation = useMutation({
    mutationFn: (assignment: Parameters<typeof lockerService.assignLocker>[0]) =>
      lockerService.assignLocker(assignment),
    onSuccess: () => {
      toast({ title: 'Locker Assigned' });
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign locker',
        variant: 'destructive',
      });
    },
  });

  const releaseLockerMutation = useMutation({
    mutationFn: ({ assignmentId, lockerId }: { assignmentId: string; lockerId: string }) =>
      lockerService.releaseLocker(assignmentId, lockerId),
    onSuccess: () => {
      toast({ title: 'Locker Released' });
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to release locker',
        variant: 'destructive',
      });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (params: {
      memberId: string;
      branchId: string;
      lockerId: string;
      lockerNumber: string;
      amount: number;
      months: number;
    }) =>
      lockerService.createLockerInvoice(
        params.memberId,
        params.branchId,
        params.lockerId,
        params.lockerNumber,
        params.amount,
        params.months
      ),
    onSuccess: () => {
      toast({ title: 'Invoice Created' });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create invoice',
        variant: 'destructive',
      });
    },
  });

  return {
    lockers,
    availableLockers,
    createLocker: createLockerMutation.mutate,
    assignLocker: assignLockerMutation.mutate,
    releaseLocker: releaseLockerMutation.mutate,
    createInvoice: createInvoiceMutation.mutateAsync,
    isCreating: createLockerMutation.isPending,
    isAssigning: assignLockerMutation.isPending,
  };
}
