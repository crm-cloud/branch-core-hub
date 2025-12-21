import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Clock, Pause, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ApprovalRequestsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId?: string;
}

export function ApprovalRequestsDrawer({ open, onOpenChange, branchId }: ApprovalRequestsDrawerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('pending');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['approval-requests', branchId, activeTab],
    queryFn: async () => {
      let query = supabase
        .from('approval_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      if (activeTab !== 'all' && (activeTab === 'pending' || activeTab === 'approved' || activeTab === 'rejected')) {
        query = query.eq('status', activeTab);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ requestId, approved }: { requestId: string; approved: boolean }) => {
      const request = requests.find(r => r.id === requestId);
      if (!request) throw new Error('Request not found');

      // Update approval request
      const { error: approvalError } = await supabase
        .from('approval_requests')
        .update({
          status: approved ? 'approved' : 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes[requestId] || null,
        })
        .eq('id', requestId);

      if (approvalError) throw approvalError;

      // If approved and it's a freeze request, update the freeze history
      if (approved && request.approval_type === 'membership_freeze') {
        const requestData = request.request_data as any;
        
        // Update freeze history status
        const { error: freezeError } = await supabase
          .from('membership_freeze_history')
          .update({
            status: 'approved',
            approved_by: user?.id,
            approved_at: new Date().toISOString(),
          })
          .eq('id', request.reference_id);

        if (freezeError) throw freezeError;

        // Check if freeze starts today or earlier, then update membership status
        const freezeStart = new Date(requestData.startDate);
        if (freezeStart <= new Date()) {
          await supabase
            .from('memberships')
            .update({ status: 'frozen' })
            .eq('id', requestData.membershipId);
        }
      } else if (!approved && request.approval_type === 'membership_freeze') {
        // Update freeze history status to rejected
        await supabase
          .from('membership_freeze_history')
          .update({ status: 'rejected' })
          .eq('id', request.reference_id);
      }

      return { approved };
    },
    onSuccess: (data) => {
      toast.success(data.approved ? 'Request approved' : 'Request rejected');
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member-details'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to process request');
    },
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-warning/10 text-warning',
      approved: 'bg-success/10 text-success',
      rejected: 'bg-destructive/10 text-destructive',
    };
    return <Badge className={styles[status] || 'bg-muted'}>{status}</Badge>;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'membership_freeze':
        return <Pause className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const renderRequestDetails = (request: any) => {
    const data = request.request_data as any;
    
    if (request.approval_type === 'membership_freeze') {
      return (
        <div className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Member:</span> {data.memberName}</p>
          <p><span className="text-muted-foreground">Duration:</span> {data.daysFrozen} days</p>
          <p><span className="text-muted-foreground">From:</span> {format(new Date(data.startDate), 'dd MMM yyyy')}</p>
          <p><span className="text-muted-foreground">To:</span> {format(new Date(data.endDate), 'dd MMM yyyy')}</p>
          {data.reason && <p><span className="text-muted-foreground">Reason:</span> {data.reason}</p>}
          {data.feeCharged > 0 && <p><span className="text-muted-foreground">Fee:</span> ₹{data.feeCharged}</p>}
        </div>
      );
    }

    return <pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Approval Requests
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : requests.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No {activeTab} requests
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <Card key={request.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          {getTypeIcon(request.approval_type)}
                          <span className="capitalize">{request.approval_type.replace('_', ' ')}</span>
                        </CardTitle>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(request.created_at), 'dd MMM yyyy, HH:mm')}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {renderRequestDetails(request)}

                      {request.status === 'pending' && (
                        <>
                          <Textarea
                            placeholder="Review notes (optional)"
                            value={reviewNotes[request.id] || ''}
                            onChange={(e) => setReviewNotes({ ...reviewNotes, [request.id]: e.target.value })}
                            rows={2}
                            className="mt-3"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-destructive hover:bg-destructive/10"
                              onClick={() => approveMutation.mutate({ requestId: request.id, approved: false })}
                              disabled={approveMutation.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => approveMutation.mutate({ requestId: request.id, approved: true })}
                              disabled={approveMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          </div>
                        </>
                      )}

                      {request.review_notes && request.status !== 'pending' && (
                        <div className="text-sm text-muted-foreground border-t pt-2">
                          <span className="font-medium">Notes:</span> {request.review_notes}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
