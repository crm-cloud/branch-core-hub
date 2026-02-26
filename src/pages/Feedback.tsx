import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { Switch } from '@/components/ui/switch';
import { Star, MessageSquare, CheckCircle, Clock, Eye, Globe } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranchContext } from '@/contexts/BranchContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function FeedbackPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const queryClient = useQueryClient();
  const { effectiveBranchId: branchId = '' } = useBranchContext();

  const { data: feedbackList = [], isLoading } = useQuery({
    queryKey: ['feedback', branchId, statusFilter],
    queryFn: async () => {
      if (!branchId) return [];
      
      // First get feedback with basic relations
      let query = supabase
        .from('feedback')
        .select(`
          *,
          members(member_code, user_id),
          employees(user_id),
          trainers(user_id)
        `)
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Get all unique user_ids and fetch profiles
      const userIds = new Set<string>();
      (data || []).forEach((f: any) => {
        if (f.members?.user_id) userIds.add(f.members.user_id);
        if (f.employees?.user_id) userIds.add(f.employees.user_id);
        if (f.trainers?.user_id) userIds.add(f.trainers.user_id);
      });
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(userIds));
      
      const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));
      
      // Enrich feedback with profile names
      return (data || []).map((f: any) => ({
        ...f,
        member_name: f.members?.user_id ? profileMap.get(f.members.user_id) : null,
        trainer_name: f.trainers?.user_id ? profileMap.get(f.trainers.user_id) : null,
        employee_name: f.employees?.user_id ? profileMap.get(f.employees.user_id) : null,
      }));
    },
    enabled: !!branchId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, notes, isApprovedForGoogle }: { id: string; status?: string; notes?: string; isApprovedForGoogle?: boolean }) => {
      const updates: any = {};
      if (status !== undefined) updates.status = status;
      if (notes !== undefined) updates.admin_notes = notes;
      if (isApprovedForGoogle !== undefined) updates.is_approved_for_google = isApprovedForGoogle;
      
      const { error } = await supabase
        .from('feedback')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Feedback updated');
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
    onError: () => {
      toast.error('Failed to update feedback');
    },
  });

  // Mock function to prepare review data for Google Business Profile API
  const syncToGoogleMyBusiness = async (reviewId: string, feedback: any) => {
    const reviewData = {
      reviewId,
      starRating: feedback.rating,
      comment: feedback.feedback_text,
      reviewerName: feedback.member_name || 'Anonymous',
      createTime: feedback.created_at,
      // Google Business Profile API endpoint would be:
      // POST https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews/{reviewId}/reply
    };
    
    console.log('Prepared for Google Business sync:', reviewData);
    toast.success('Review prepared for Google Business sync');
    
    // Update the database to mark as published
    await supabase
      .from('feedback')
      .update({ published_to_google_at: new Date().toISOString() })
      .eq('id', reviewId);
    
    queryClient.invalidateQueries({ queryKey: ['feedback'] });
    return reviewData;
  };

  const stats = {
    total: feedbackList.length,
    avgRating: feedbackList.length
      ? (feedbackList.reduce((sum: number, f: any) => sum + (f.rating || 0), 0) / feedbackList.length).toFixed(1)
      : '0',
    pending: feedbackList.filter((f: any) => f.status === 'pending').length,
    resolved: feedbackList.filter((f: any) => f.status === 'resolved').length,
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'text-green-500';
    if (rating >= 3) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'reviewed':
        return <Badge className="bg-blue-500/10 text-blue-500"><Eye className="w-3 h-3 mr-1" />Reviewed</Badge>;
      case 'resolved':
        return <Badge className="bg-green-500/10 text-green-500"><CheckCircle className="w-3 h-3 mr-1" />Resolved</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Member Feedback</h1>
            <p className="text-muted-foreground">Review and manage feedback submitted by members</p>
          </div>
          {/* Branch selector moved to global header */}
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard
            title="Total Feedback"
            value={stats.total}
            icon={MessageSquare}
          />
          <StatCard
            title="Average Rating"
            value={stats.avgRating}
            icon={Star}
            variant={Number(stats.avgRating) >= 4 ? 'success' : Number(stats.avgRating) >= 3 ? 'warning' : 'destructive'}
          />
          <StatCard
            title="Pending Review"
            value={stats.pending}
            icon={Clock}
            variant={stats.pending > 0 ? 'warning' : 'default'}
          />
          <StatCard
            title="Resolved"
            value={stats.resolved}
            icon={CheckCircle}
            variant="success"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Feedback Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Feedback</TableHead>
                    <TableHead>Related To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Google</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedbackList.map((feedback: any) => (
                    <TableRow key={feedback.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{feedback.member_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{feedback.members?.member_code}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1 ${getRatingColor(feedback.rating)}`}>
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${i < feedback.rating ? 'fill-current' : 'text-muted'}`}
                            />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{feedback.category}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-sm truncate">{feedback.feedback_text || '-'}</p>
                      </TableCell>
                      <TableCell>
                        {feedback.trainer_name && (
                          <p className="text-xs">Trainer: {feedback.trainer_name}</p>
                        )}
                        {feedback.employee_name && (
                          <p className="text-xs">Staff: {feedback.employee_name}</p>
                        )}
                        {!feedback.trainer_name && !feedback.employee_name && '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(feedback.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={feedback.is_approved_for_google || false}
                            onCheckedChange={(checked) => 
                              updateStatus.mutate({ id: feedback.id, isApprovedForGoogle: checked })
                            }
                          />
                          {feedback.is_approved_for_google && (
                            <Globe className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(feedback.created_at), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={feedback.status}
                          onValueChange={(status) => updateStatus.mutate({ id: feedback.id, status })}
                        >
                          <SelectTrigger className="w-[120px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="reviewed">Reviewed</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                  {feedbackList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No feedback recorded yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
