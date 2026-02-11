import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useMemberData } from '@/hooks/useMemberData';
import { Snowflake, User, Clock, AlertCircle, Loader2, CheckCircle, XCircle, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function MemberRequests() {
  const queryClient = useQueryClient();
  const { member, activeMembership, isLoading: memberLoading } = useMemberData();
  const [freezeReason, setFreezeReason] = useState('');
  const [trainerChangeReason, setTrainerChangeReason] = useState('');
  const [freezeSheetOpen, setFreezeSheetOpen] = useState(false);
  const [trainerSheetOpen, setTrainerSheetOpen] = useState(false);

  // Fetch existing requests
  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['my-requests', member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_requests')
        .select('*')
        .eq('reference_id', member!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Submit freeze request
  const submitFreezeRequest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('approval_requests')
        .insert({
          approval_type: 'membership_freeze' as const,
          reference_type: 'member',
          reference_id: member!.id,
          branch_id: member!.branch_id,
          request_data: {
            membership_id: activeMembership?.id,
            reason: freezeReason,
            requested_at: new Date().toISOString(),
          },
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Freeze request submitted');
      setFreezeSheetOpen(false);
      setFreezeReason('');
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
    },
    onError: () => {
      toast.error('Failed to submit request');
    },
  });

  // Submit trainer change request - using discount as placeholder since trainer_change isn't in enum
  const submitTrainerChangeRequest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('approval_requests')
        .insert({
          approval_type: 'complimentary' as const, // Using complimentary as generic request type
          reference_type: 'trainer_change',
          reference_id: member!.id,
          branch_id: member!.branch_id,
          request_data: {
            current_trainer_id: member!.assigned_trainer_id,
            reason: trainerChangeReason,
            requested_at: new Date().toISOString(),
          },
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Trainer change request submitted');
      setTrainerSheetOpen(false);
      setTrainerChangeReason('');
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
    },
    onError: () => {
      toast.error('Failed to submit request');
    },
  });

  if (memberLoading || requestsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </AppLayout>
    );
  }

  if (!member) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <AlertCircle className="h-12 w-12 text-warning" />
          <h2 className="text-xl font-semibold">No Member Profile Found</h2>
        </div>
      </AppLayout>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-success"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'membership_freeze':
        return 'Membership Freeze';
      case 'membership_unfreeze':
        return 'Membership Unfreeze';
      case 'trainer_change':
        return 'Trainer Change';
      default:
        return type;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Requests</h1>
          <p className="text-muted-foreground">Manage membership and service requests</p>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Freeze Request */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Snowflake className="h-5 w-5" />
                Freeze Membership
              </CardTitle>
              <CardDescription>
                Temporarily pause your membership while you're away
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Sheet open={freezeSheetOpen} onOpenChange={setFreezeSheetOpen}>
                <SheetTrigger asChild>
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={!activeMembership || activeMembership.status === 'frozen'}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Request Freeze
                  </Button>
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle>Request Membership Freeze</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium">Reason for freeze</label>
                      <Textarea
                        placeholder="e.g., Traveling for work, Medical reasons, etc."
                        value={freezeReason}
                        onChange={(e) => setFreezeReason(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Your request will be reviewed by the management. You'll be notified once approved.
                    </p>
                  </div>
                  <SheetFooter>
                    <Button
                      variant="outline"
                      onClick={() => setFreezeSheetOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => submitFreezeRequest.mutate()}
                      disabled={!freezeReason || submitFreezeRequest.isPending}
                    >
                      Submit Request
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </CardContent>
          </Card>

          {/* Trainer Change Request */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {member.assigned_trainer_id ? 'Change Trainer' : 'Request Trainer'}
              </CardTitle>
              <CardDescription>
                {member.assigned_trainer_id 
                  ? 'Request a different personal trainer' 
                  : 'Request a personal trainer assignment'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Sheet open={trainerSheetOpen} onOpenChange={setTrainerSheetOpen}>
                <SheetTrigger asChild>
                  <Button className="w-full" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    {member.assigned_trainer_id ? 'Request Trainer Change' : 'Request Trainer'}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle>Request Trainer Change</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium">Reason for change</label>
                      <Textarea
                        placeholder="e.g., Schedule conflicts, Training style preference, etc."
                        value={trainerChangeReason}
                        onChange={(e) => setTrainerChangeReason(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Your request will be reviewed and a suitable trainer will be assigned.
                    </p>
                  </div>
                  <SheetFooter>
                    <Button
                      variant="outline"
                      onClick={() => setTrainerSheetOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => submitTrainerChangeRequest.mutate()}
                      disabled={!trainerChangeReason || submitTrainerChangeRequest.isPending}
                    >
                      Submit Request
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </CardContent>
          </Card>
        </div>

        {/* Request History */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Request History</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No requests yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request: any) => (
                  <Card key={request.id} className="border-border/50">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{getRequestTypeLabel(request.approval_type)}</h4>
                          <p className="text-sm text-muted-foreground">
                            Submitted on {format(new Date(request.created_at), 'dd MMM yyyy')}
                          </p>
                          {request.request_data?.reason && (
                            <p className="text-sm mt-2">{request.request_data.reason}</p>
                          )}
                          {request.review_notes && (
                            <p className="text-sm text-muted-foreground mt-2">
                              <span className="font-medium">Response:</span> {request.review_notes}
                            </p>
                          )}
                        </div>
                        {getStatusBadge(request.status)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
