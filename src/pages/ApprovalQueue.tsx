import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBranchContext } from '@/contexts/BranchContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

const safeFormatDate = (value: any, fmt: string = 'dd MMM yyyy', fallback: string = '-') => {
  if (!value) return fallback;
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return fallback;
    return format(date, fmt);
  } catch {
    return fallback;
  }
};
import {
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Pause,
  Calendar,
  CreditCard,
  Percent,
  Gift,
  FileText,
  DollarSign,
  ArrowLeftRight,
  CheckCircle2,
  User,
} from 'lucide-react';

import { Building2 } from 'lucide-react';

const APPROVAL_TYPE_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  membership_freeze: { icon: Pause, label: 'Freeze', color: 'bg-info/10 text-info' },
  membership_transfer: { icon: ArrowLeftRight, label: 'Membership Transfer', color: 'bg-primary/10 text-primary' },
  branch_transfer: { icon: Building2, label: 'Branch Transfer', color: 'bg-violet-500/10 text-violet-600' },
  refund: { icon: DollarSign, label: 'Refund', color: 'bg-destructive/10 text-destructive' },
  discount: { icon: Percent, label: 'Discount', color: 'bg-warning/10 text-warning' },
  complimentary: { icon: Gift, label: 'Complimentary', color: 'bg-success/10 text-success' },
  comp_gift: { icon: Gift, label: 'Comp/Gift', color: 'bg-amber-500/10 text-amber-600' },
  expense: { icon: CreditCard, label: 'Expense', color: 'bg-muted text-muted-foreground' },
  contract: { icon: FileText, label: 'Contract', color: 'bg-accent/10 text-accent' },
  trainer_change: { icon: User, label: 'Trainer Change', color: 'bg-primary/10 text-primary' },
};

export default function ApprovalQueuePage() {
  const { user } = useAuth();
  const { branchFilter, selectedBranch, setSelectedBranch, branches } = useBranchContext();
  const [activeTab, setActiveTab] = useState('pending');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  // Fetch approval requests
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['approval-queue', branchFilter, activeTab, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from('approval_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (branchFilter) {
        query = query.eq('branch_id', branchFilter);
      }

      if (activeTab !== 'all') {
        query = query.eq('status', activeTab as 'pending' | 'approved' | 'rejected');
      }

      if (typeFilter !== 'all') {
        query = query.eq('approval_type', typeFilter as 'membership_freeze' | 'membership_transfer' | 'refund' | 'discount' | 'complimentary' | 'expense' | 'contract');
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Stats queries
  const { data: stats } = useQuery({
    queryKey: ['approval-stats', branchFilter],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      let pendingQuery = supabase.from('approval_requests').select('id', { count: 'exact' }).eq('status', 'pending');
      let approvedQuery = supabase.from('approval_requests').select('id', { count: 'exact' }).eq('status', 'approved').gte('reviewed_at', today);
      let rejectedQuery = supabase.from('approval_requests').select('id', { count: 'exact' }).eq('status', 'rejected').gte('reviewed_at', today);

      if (branchFilter) {
        pendingQuery = pendingQuery.eq('branch_id', branchFilter);
        approvedQuery = approvedQuery.eq('branch_id', branchFilter);
        rejectedQuery = rejectedQuery.eq('branch_id', branchFilter);
      }

      const [{ count: pending }, { count: approved }, { count: rejected }] = await Promise.all([
        pendingQuery,
        approvedQuery,
        rejectedQuery,
      ]);

      return { pending: pending || 0, approvedToday: approved || 0, rejectedToday: rejected || 0 };
    },
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('approval-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approval_requests' }, () => {
        queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
        queryClient.invalidateQueries({ queryKey: ['approval-stats'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Process approval mutation
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

      const requestData = request.request_data as any;
      // Handle both camelCase (new) and snake_case (old) key formats
      const membershipId = requestData.membershipId || requestData.membership_id;

      // Handle specific approval types
      if (approved) {
        if (request.approval_type === 'membership_freeze' && request.reference_type !== 'membership_unfreeze') {
          // Update freeze history status
          await supabase
            .from('membership_freeze_history')
            .update({
              status: 'approved',
              approved_by: user?.id,
              approved_at: new Date().toISOString(),
            })
            .eq('id', request.reference_id);

          // Apply freeze - update membership status to frozen
          if (membershipId) {
            await supabase
              .from('memberships')
              .update({ status: 'frozen' })
              .eq('id', membershipId);
          }
        } else if (request.reference_type === 'membership_unfreeze') {
          // Handle unfreeze - resume membership
          if (membershipId) {
            // Get the membership to calculate new end date
            const { data: membership } = await supabase
              .from('memberships')
              .select('*')
              .eq('id', membershipId)
              .single();

            if (membership) {
              // Get freeze history to calculate total frozen days
              const { data: freezeHistory } = await supabase
                .from('membership_freeze_history')
                .select('*')
                .eq('membership_id', membershipId)
                .eq('status', 'approved');

              // Calculate total frozen days
              const totalFrozenDays = (freezeHistory || []).reduce((sum: number, f: any) => {
                const start = new Date(f.start_date);
                const end = f.end_date ? new Date(f.end_date) : new Date();
                return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
              }, 0);

              // Extend end date by frozen days
              const originalEnd = new Date(membership.end_date);
              originalEnd.setDate(originalEnd.getDate() + totalFrozenDays);

              await supabase
                .from('memberships')
                .update({
                  status: 'active',
                  end_date: originalEnd.toISOString().split('T')[0],
                })
                .eq('id', membershipId);
            }
          }
        } else if (request.reference_type === 'trainer_change') {
          // Handle trainer change - update member's assigned trainer
          if (requestData.memberId && requestData.newTrainerId) {
            await supabase
              .from('members')
              .update({ assigned_trainer_id: requestData.newTrainerId })
              .eq('id', requestData.memberId);
          }
        } else if (request.approval_type === 'membership_transfer') {
          // Handle membership transfer approval — atomic: deactivate old + create new
          const toMemberId = requestData.to_member_id;
          const msId = requestData.membershipId || request.reference_id;
          if (toMemberId && msId) {
            // Fetch the original membership to calculate remaining days
            const { data: originalMs } = await supabase
              .from('memberships')
              .select('*, membership_plans(name, price, duration_days)')
              .eq('id', msId)
              .single();

            if (originalMs) {
              const todayStr = new Date().toISOString().split('T')[0];
              const endDate = new Date(originalMs.end_date);
              const todayDate = new Date(todayStr);
              const remainingDays = Math.max(0, Math.ceil((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)));

              // 1. Deactivate original membership
              await supabase
                .from('memberships')
                .update({ status: 'transferred' as any, end_date: todayStr })
                .eq('id', msId);

              // 2. Create new membership for recipient
              const newEndDate = new Date(todayDate);
              newEndDate.setDate(newEndDate.getDate() + remainingDays);
              await supabase
                .from('memberships')
                .insert({
                  member_id: toMemberId,
                  plan_id: requestData.plan_id || originalMs.plan_id,
                  branch_id: requestData.branch_id || request.branch_id,
                  start_date: todayStr,
                  end_date: newEndDate.toISOString().split('T')[0],
                  original_end_date: newEndDate.toISOString().split('T')[0],
                  status: 'active',
                } as any);
            }

            // Create transfer fee invoice if chargeable
            if (requestData.is_chargeable && requestData.transfer_fee > 0) {
              const fee = requestData.transfer_fee;
              const { data: invoice } = await supabase
                .from('invoices')
                .insert({
                  branch_id: request.branch_id,
                  member_id: toMemberId,
                  subtotal: fee,
                  total_amount: fee,
                  amount_paid: 0,
                  status: 'pending',
                  due_date: new Date().toISOString().split('T')[0],
                  invoice_type: 'membership_transfer',
                })
                .select('id')
                .single();

              if (invoice) {
                await supabase.from('invoice_items').insert({
                  invoice_id: invoice.id,
                  description: `Membership Transfer Fee from ${requestData.from_member_name}`,
                  unit_price: fee,
                  quantity: 1,
                  total_amount: fee,
                  reference_type: 'membership_transfer',
                  reference_id: msId,
                });
              }
            }

            await supabase.from('audit_logs').insert({
              action: 'MEMBERSHIP_TRANSFER',
              table_name: 'memberships',
              record_id: msId,
              user_id: user?.id,
              branch_id: request.branch_id,
              old_data: { member_id: requestData.from_member_id, member_name: requestData.from_member_name },
              new_data: { member_id: toMemberId, member_name: requestData.to_member_name },
              action_description: `Approved membership transfer from ${requestData.from_member_name} to ${requestData.to_member_name}. Original membership deactivated, new membership created with remaining days. ${requestData.is_chargeable ? `Fee: ₹${requestData.transfer_fee}` : 'Free transfer'}. Reason: ${requestData.reason}`,
            });
          }
        } else if (request.approval_type === 'branch_transfer') {
          // Handle branch transfer approval
          const mId = requestData.member_id || request.reference_id;
          const toBranchId = requestData.to_branch_id;
          if (mId && toBranchId) {
            await supabase
              .from('members')
              .update({ branch_id: toBranchId })
              .eq('id', mId);

            await supabase
              .from('memberships')
              .update({ branch_id: toBranchId })
              .eq('member_id', mId)
              .in('status', ['active', 'frozen']);

            await supabase.from('audit_logs').insert({
              action: 'BRANCH_TRANSFER',
              table_name: 'members',
              record_id: mId,
              user_id: user?.id,
              branch_id: toBranchId,
              old_data: { branch_id: requestData.from_branch_id, branch_name: requestData.from_branch_name },
              new_data: { branch_id: toBranchId, branch_name: requestData.to_branch_name },
              action_description: `Approved branch transfer for ${requestData.memberName} from ${requestData.from_branch_name} to ${requestData.to_branch_name}. Reason: ${requestData.reason}`,
            });
          }
        } else if (request.approval_type === 'comp_gift') {
          // Handle comp/gift approval
          if (request.reference_type === 'extend_days') {
            // Extend membership end date
            const msId = requestData.membershipId;
            if (msId && requestData.days) {
              const { data: ms } = await supabase
                .from('memberships')
                .select('end_date')
                .eq('id', msId)
                .single();
              if (ms) {
                const currentEnd = new Date(ms.end_date);
                currentEnd.setDate(currentEnd.getDate() + requestData.days);
                await supabase
                  .from('memberships')
                  .update({ end_date: currentEnd.toISOString().split('T')[0] })
                  .eq('id', msId);
              }
            }
          } else if (request.reference_type === 'comp_sessions') {
            // Insert comp sessions
            await supabase.from('member_comps').insert({
              member_id: requestData.memberId,
              membership_id: requestData.membershipId || null,
              benefit_type_id: requestData.benefitTypeId,
              comp_sessions: requestData.sessions,
              used_sessions: 0,
              reason: requestData.reason || 'Approved comp',
              granted_by: user?.id,
            });
          }
        }
      } else {
        // Handle rejection
        if (request.approval_type === 'membership_freeze') {
          await supabase
            .from('membership_freeze_history')
            .update({ status: 'rejected' })
            .eq('id', request.reference_id);
        }
      }

      return { approved };
    },
    onSuccess: (data) => {
      toast.success(data.approved ? 'Request approved' : 'Request rejected');
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
      queryClient.invalidateQueries({ queryKey: ['approval-stats'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to process request');
    },
  });

  // Filter by search
  const filteredRequests = requests.filter((r) => {
    if (!search) return true;
    const data = r.request_data as any;
    const searchLower = search.toLowerCase();
    return (
      data?.memberName?.toLowerCase().includes(searchLower) ||
      data?.memberCode?.toLowerCase().includes(searchLower) ||
      r.approval_type?.toLowerCase().includes(searchLower)
    );
  });

  const getTypeConfig = (type: string) => {
    return APPROVAL_TYPE_CONFIG[type] || { icon: Calendar, label: type.replace('_', ' '), color: 'bg-muted text-muted-foreground' };
  };

  const renderRequestDetails = (request: any) => {
    const data = request.request_data as any;

    if (request.approval_type === 'membership_freeze') {
      return (
        <div className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Member:</span> {data.memberName}</p>
          <p><span className="text-muted-foreground">Duration:</span> {data.daysFrozen} days</p>
          <p><span className="text-muted-foreground">Period:</span> {safeFormatDate(data.startDate, 'dd MMM', 'Pending')} - {safeFormatDate(data.endDate, 'dd MMM yyyy', 'Pending')}</p>
          {data.reason && <p><span className="text-muted-foreground">Reason:</span> {data.reason}</p>}
        </div>
      );
    }

    if (request.reference_type === 'trainer_change') {
      return (
        <div className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Member:</span> {data.memberName || 'N/A'}</p>
          <p><span className="text-muted-foreground">Current Trainer:</span> {data.currentTrainerName || 'None'}</p>
          <p><span className="text-muted-foreground">New Trainer:</span> {data.newTrainerName || 'N/A'}</p>
          {data.reason && <p><span className="text-muted-foreground">Reason:</span> {data.reason}</p>}
        </div>
      );
    }

    if (request.approval_type === 'comp_gift') {
      return (
        <div className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Member:</span> {data.memberName}</p>
          {request.reference_type === 'extend_days' ? (
            <>
              <p><span className="text-muted-foreground">Type:</span> Extend Days (+{data.days})</p>
              <p><span className="text-muted-foreground">New Expiry:</span> {safeFormatDate(data.newEndDate, 'dd MMM yyyy', 'N/A')}</p>
            </>
          ) : (
            <>
              <p><span className="text-muted-foreground">Type:</span> Comp Sessions ({data.sessions}x)</p>
              <p><span className="text-muted-foreground">Benefit:</span> {data.benefitTypeName}</p>
            </>
          )}
          {data.reason && <p><span className="text-muted-foreground">Reason:</span> {data.reason}</p>}
        </div>
      );
    }

    if (request.approval_type === 'membership_transfer') {
      return (
        <div className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">From:</span> {data.from_member_name}</p>
          <p><span className="text-muted-foreground">To:</span> {data.to_member_name} {data.to_member_code ? `(${data.to_member_code})` : ''}</p>
          {data.is_chargeable && <p><span className="text-muted-foreground">Fee:</span> ₹{data.transfer_fee}</p>}
          {data.reason && <p><span className="text-muted-foreground">Reason:</span> {data.reason}</p>}
        </div>
      );
    }

    if (request.approval_type === 'branch_transfer') {
      return (
        <div className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Member:</span> {data.memberName}</p>
          <p><span className="text-muted-foreground">From:</span> {data.from_branch_name}</p>
          <p><span className="text-muted-foreground">To:</span> {data.to_branch_name}</p>
          {data.reason && <p><span className="text-muted-foreground">Reason:</span> {data.reason}</p>}
        </div>
      );
    }

    return (
      <div className="text-sm">
        {data?.memberName && <p><span className="text-muted-foreground">Member:</span> {data.memberName}</p>}
        {data?.amount && <p><span className="text-muted-foreground">Amount:</span> ₹{data.amount}</p>}
        {data?.reason && <p><span className="text-muted-foreground">Reason:</span> {data.reason}</p>}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Approval Queue</h1>
            <p className="text-muted-foreground">Review and process pending requests</p>
          </div>
          {/* Branch selector moved to global header */}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-3">
          <Card className="border-l-4 border-l-warning">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-warning">{stats?.pending || 0}</p>
                </div>
                <Clock className="h-8 w-8 text-warning/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-success">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Approved Today</p>
                  <p className="text-2xl font-bold text-success">{stats?.approvedToday || 0}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-success/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-destructive">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rejected Today</p>
                  <p className="text-2xl font-bold text-destructive">{stats?.rejectedToday || 0}</p>
                </div>
                <XCircle className="h-8 w-8 text-destructive/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Tabs */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by member name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="membership_freeze">Freeze</SelectItem>
                  <SelectItem value="membership_transfer">Membership Transfer</SelectItem>
                  <SelectItem value="branch_transfer">Branch Transfer</SelectItem>
                  <SelectItem value="comp_gift">Comp/Gift</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                  <SelectItem value="discount">Discount</SelectItem>
                  <SelectItem value="complimentary">Complimentary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="pending" className="gap-2">
                  Pending
                  {stats?.pending ? <Badge variant="secondary" className="ml-1">{stats.pending}</Badge> : null}
                </TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {activeTab === 'pending' ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-12 w-12 text-success/50" />
                        <p>All caught up! No pending requests.</p>
                      </div>
                    ) : (
                      <p>No {activeTab} requests found</p>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredRequests.map((request) => {
                      const config = getTypeConfig(request.approval_type);
                      const TypeIcon = config.icon;

                      return (
                        <Card key={request.id} className="relative overflow-hidden">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <Badge className={config.color}>
                                <TypeIcon className="h-3 w-3 mr-1" />
                                {config.label}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={
                                  request.status === 'pending'
                                    ? 'bg-warning/10 text-warning border-warning/20'
                                    : request.status === 'approved'
                                    ? 'bg-success/10 text-success border-success/20'
                                    : 'bg-destructive/10 text-destructive border-destructive/20'
                                }
                              >
                                {request.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {safeFormatDate(request.created_at, 'dd MMM yyyy, HH:mm')}
                            </p>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {renderRequestDetails(request)}

                            {request.status === 'pending' && (
                              <>
                                <Textarea
                                  placeholder="Add notes (optional)"
                                  value={reviewNotes[request.id] || ''}
                                  onChange={(e) => setReviewNotes({ ...reviewNotes, [request.id]: e.target.value })}
                                  rows={2}
                                  className="mt-2"
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
                              <p className="text-xs text-muted-foreground border-t pt-2">
                                <span className="font-medium">Notes:</span> {request.review_notes}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
