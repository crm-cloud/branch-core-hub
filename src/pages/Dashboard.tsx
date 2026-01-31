import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/stat-card';
import { BranchSelector } from '@/components/dashboard/BranchSelector';
import { RevenueChart, AttendanceChart, MembershipDistribution, HourlyAttendanceChart, RevenueSnapshotWidget, ExpiringMembersWidget, PendingApprovalsWidget } from '@/components/dashboard/DashboardCharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBranches } from '@/hooks/useBranches';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import LiveAccessLog from '@/components/devices/LiveAccessLog';
import { 
  Users, 
  CreditCard, 
  UserCheck, 
  Dumbbell, 
  Calendar,
  AlertCircle,
  UserPlus,
  Clock,
  Receipt,
  Activity,
  Snowflake
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, differenceInHours } from 'date-fns';

export default function DashboardPage() {
  const { profile, roles, user } = useAuth();
  const { data: branches = [] } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  const branchFilter = selectedBranch !== 'all' ? selectedBranch : undefined;

  // Fetch dashboard statistics
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats', branchFilter],
    enabled: !!user,
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = startOfMonth(new Date()).toISOString();
      const monthEnd = endOfMonth(new Date()).toISOString();

      // Members count
      let membersQuery = supabase.from('members').select('id, status', { count: 'exact' });
      if (branchFilter) membersQuery = membersQuery.eq('branch_id', branchFilter);
      const { count: totalMembers } = await membersQuery;

      let activeMembersQuery = supabase.from('members').select('id', { count: 'exact' }).eq('status', 'active');
      if (branchFilter) activeMembersQuery = activeMembersQuery.eq('branch_id', branchFilter);
      const { count: activeMembers } = await activeMembersQuery;

      // Frozen memberships count
      let frozenQuery = supabase.from('memberships').select('id', { count: 'exact' }).eq('status', 'frozen');
      if (branchFilter) frozenQuery = frozenQuery.eq('branch_id', branchFilter);
      const { count: frozenMemberships } = await frozenQuery;

      // Today's attendance
      let attendanceQuery = supabase.from('member_attendance').select('id', { count: 'exact' }).gte('check_in', today);
      if (branchFilter) attendanceQuery = attendanceQuery.eq('branch_id', branchFilter);
      const { count: todayCheckins } = await attendanceQuery;

      // Currently in gym
      let currentQuery = supabase.from('member_attendance').select('id', { count: 'exact' }).gte('check_in', today).is('check_out', null);
      if (branchFilter) currentQuery = currentQuery.eq('branch_id', branchFilter);
      const { count: currentlyIn } = await currentQuery;

      // Monthly revenue
      let paymentsQuery = supabase.from('payments').select('amount').gte('payment_date', monthStart).lte('payment_date', monthEnd);
      if (branchFilter) paymentsQuery = paymentsQuery.eq('branch_id', branchFilter);
      const { data: payments } = await paymentsQuery;
      const monthlyRevenue = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;

      // Expiring memberships (next 7 days)
      const next7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      let expiringQuery = supabase.from('memberships').select('id', { count: 'exact' }).eq('status', 'active').lte('end_date', next7Days).gte('end_date', today);
      if (branchFilter) expiringQuery = expiringQuery.eq('branch_id', branchFilter);
      const { count: expiringMemberships } = await expiringQuery;

      // New leads this month
      let leadsQuery = supabase.from('leads').select('id', { count: 'exact' }).gte('created_at', monthStart);
      if (branchFilter) leadsQuery = leadsQuery.eq('branch_id', branchFilter);
      const { count: newLeads } = await leadsQuery;

      // Pending invoices
      let invoicesQuery = supabase.from('invoices').select('id, total_amount', { count: 'exact' }).eq('status', 'pending');
      if (branchFilter) invoicesQuery = invoicesQuery.eq('branch_id', branchFilter);
      const { data: pendingInvoices, count: pendingInvoiceCount } = await invoicesQuery;
      const pendingAmount = pendingInvoices?.reduce((sum, i) => sum + i.total_amount, 0) || 0;

      // Active trainers
      let trainersQuery = supabase.from('trainers').select('id', { count: 'exact' }).eq('is_active', true);
      if (branchFilter) trainersQuery = trainersQuery.eq('branch_id', branchFilter);
      const { count: activeTrainers } = await trainersQuery;

      // Today's classes
      let classesQuery = supabase.from('classes').select('id', { count: 'exact' }).gte('scheduled_at', today).lt('scheduled_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
      if (branchFilter) classesQuery = classesQuery.eq('branch_id', branchFilter);
      const { count: todayClasses } = await classesQuery;

      // Pending approvals
      let approvalsQuery = supabase.from('approval_requests').select('id', { count: 'exact' }).eq('status', 'pending');
      if (branchFilter) approvalsQuery = approvalsQuery.eq('branch_id', branchFilter);
      const { count: pendingApprovals } = await approvalsQuery;

      return {
        totalMembers: totalMembers || 0,
        activeMembers: activeMembers || 0,
        frozenMemberships: frozenMemberships || 0,
        todayCheckins: todayCheckins || 0,
        currentlyIn: currentlyIn || 0,
        monthlyRevenue,
        expiringMemberships: expiringMemberships || 0,
        newLeads: newLeads || 0,
        pendingInvoiceCount: pendingInvoiceCount || 0,
        pendingAmount,
        activeTrainers: activeTrainers || 0,
        todayClasses: todayClasses || 0,
        pendingApprovals: pendingApprovals || 0,
      };
    },
  });

  // Revenue chart data (last 6 months)
  const { data: revenueData = [] } = useQuery({
    queryKey: ['revenue-chart', branchFilter],
    enabled: !!user,
    queryFn: async () => {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = subDays(new Date(), i * 30);
        const monthStart = startOfMonth(date).toISOString();
        const monthEnd = endOfMonth(date).toISOString();
        
        let query = supabase.from('payments').select('amount').gte('payment_date', monthStart).lte('payment_date', monthEnd);
        if (branchFilter) query = query.eq('branch_id', branchFilter);
        const { data } = await query;
        
        months.push({
          name: format(date, 'MMM'),
          revenue: data?.reduce((sum, p) => sum + p.amount, 0) || 0,
        });
      }
      return months;
    },
  });

  // Attendance chart data (last 7 days)
  const { data: attendanceData = [] } = useQuery({
    queryKey: ['attendance-chart', branchFilter],
    enabled: !!user,
    queryFn: async () => {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dayStart = date.toISOString().split('T')[0];
        const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        let query = supabase.from('member_attendance').select('id', { count: 'exact' }).gte('check_in', dayStart).lt('check_in', dayEnd);
        if (branchFilter) query = query.eq('branch_id', branchFilter);
        const { count } = await query;
        
        days.push({
          name: format(date, 'EEE'),
          checkins: count || 0,
        });
      }
      return days;
    },
  });

  // Membership distribution
  const { data: membershipData = [] } = useQuery({
    queryKey: ['membership-distribution', branchFilter],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase.from('memberships').select('membership_plans(name)').eq('status', 'active');
      if (branchFilter) query = query.eq('branch_id', branchFilter);
      const { data } = await query;
      
      const counts: Record<string, number> = {};
      data?.forEach((m: any) => {
        const name = m.membership_plans?.name || 'Unknown';
        counts[name] = (counts[name] || 0) + 1;
      });
      
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
  });

  // Hourly attendance for today
  const { data: hourlyAttendanceData = [] } = useQuery({
    queryKey: ['hourly-attendance', branchFilter],
    enabled: !!user,
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      let query = supabase.from('member_attendance').select('check_in').gte('check_in', today);
      if (branchFilter) query = query.eq('branch_id', branchFilter);
      const { data } = await query;

      // Group by hour
      const hourCounts: Record<number, number> = {};
      for (let i = 5; i <= 22; i++) hourCounts[i] = 0;

      data?.forEach((a: any) => {
        const hour = new Date(a.check_in).getHours();
        if (hour >= 5 && hour <= 22) {
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        }
      });

      return Object.entries(hourCounts).map(([hour, count]) => ({
        hour: `${hour}:00`,
        checkins: count,
      }));
    },
  });

  // Revenue snapshot (collected vs pending)
  const { data: revenueSnapshot } = useQuery({
    queryKey: ['revenue-snapshot', branchFilter],
    enabled: !!user,
    queryFn: async () => {
      const monthStart = startOfMonth(new Date()).toISOString();
      const today = new Date().toISOString().split('T')[0];

      // Collected this month
      let collectedQuery = supabase.from('payments').select('amount').gte('payment_date', monthStart);
      if (branchFilter) collectedQuery = collectedQuery.eq('branch_id', branchFilter);
      const { data: collected } = await collectedQuery;
      const collectedAmount = collected?.reduce((sum, p) => sum + p.amount, 0) || 0;

      // Pending invoices
      let pendingQuery = supabase.from('invoices').select('total_amount, amount_paid').eq('status', 'pending');
      if (branchFilter) pendingQuery = pendingQuery.eq('branch_id', branchFilter);
      const { data: pending } = await pendingQuery;
      const pendingAmount = pending?.reduce((sum, i) => sum + (i.total_amount - (i.amount_paid || 0)), 0) || 0;

      // Overdue invoices
      let overdueQuery = supabase.from('invoices').select('total_amount, amount_paid').eq('status', 'overdue');
      if (branchFilter) overdueQuery = overdueQuery.eq('branch_id', branchFilter);
      const { data: overdue } = await overdueQuery;
      const overdueAmount = overdue?.reduce((sum, i) => sum + (i.total_amount - (i.amount_paid || 0)), 0) || 0;

      return { collected: collectedAmount, pending: pendingAmount, overdue: overdueAmount };
    },
  });

  // Expiring in 48 hours
  const { data: expiringMembers = [] } = useQuery({
    queryKey: ['expiring-48h', branchFilter],
    enabled: !!user,
    queryFn: async () => {
      const now = new Date();
      const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const today = now.toISOString().split('T')[0];

      let query = supabase
        .from('memberships')
        .select('id, end_date, member_id, members(member_code, profiles:user_id(full_name)), membership_plans(name)')
        .eq('status', 'active')
        .gte('end_date', today)
        .lte('end_date', in48h)
        .limit(5);

      if (branchFilter) query = query.eq('branch_id', branchFilter);
      const { data } = await query;

      return (data || []).map((m: any) => ({
        memberId: m.member_id,
        memberCode: m.members?.member_code,
        memberName: m.members?.profiles?.full_name || 'Unknown',
        hoursRemaining: differenceInHours(new Date(m.end_date), now),
        planName: m.membership_plans?.name || 'N/A',
      }));
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'Admin'}!
            </h1>
            <p className="text-muted-foreground">
              Here's what's happening at your gym today
            </p>
          </div>
          <BranchSelector
            branches={branches}
            selectedBranch={selectedBranch}
            onBranchChange={setSelectedBranch}
            showAllOption={true}
          />
        </div>

        {/* Primary Stats Row */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard
            title="Total Members"
            value={stats?.totalMembers || 0}
            icon={Users}
            description={`${stats?.activeMembers || 0} active`}
            variant="default"
          />
          <StatCard
            title="Today's Check-ins"
            value={stats?.todayCheckins || 0}
            icon={UserCheck}
            description={`${stats?.currentlyIn || 0} currently in gym`}
            variant="accent"
          />
          <StatCard
            title="Monthly Revenue"
            value={`₹${(stats?.monthlyRevenue || 0).toLocaleString()}`}
            icon={CreditCard}
            variant="success"
          />
          <StatCard
            title="New Leads"
            value={stats?.newLeads || 0}
            icon={UserPlus}
            description="This month"
            variant="info"
          />
        </div>

        {/* Secondary Stats Row */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
          <StatCard
            title="Expiring Soon"
            value={stats?.expiringMemberships || 0}
            icon={AlertCircle}
            description="Next 7 days"
            variant="warning"
          />
          <StatCard
            title="Pending Invoices"
            value={stats?.pendingInvoiceCount || 0}
            icon={Receipt}
            description={`₹${(stats?.pendingAmount || 0).toLocaleString()}`}
            variant="destructive"
          />
          <StatCard
            title="Active Trainers"
            value={stats?.activeTrainers || 0}
            icon={Dumbbell}
            variant="default"
          />
          <StatCard
            title="Today's Classes"
            value={stats?.todayClasses || 0}
            icon={Calendar}
            variant="accent"
          />
          <StatCard
            title="Currently In Gym"
            value={stats?.currentlyIn || 0}
            icon={Clock}
            variant="success"
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 md:grid-cols-2">
          <RevenueChart data={revenueData} />
          <AttendanceChart data={attendanceData} />
        </div>

        {/* CRM Widgets Row */}
        <div className="grid gap-6 md:grid-cols-4">
          <HourlyAttendanceChart data={hourlyAttendanceData} />
          <RevenueSnapshotWidget data={revenueSnapshot} />
          <ExpiringMembersWidget data={expiringMembers} />
          <PendingApprovalsWidget count={stats?.pendingApprovals || 0} />
        </div>

        {/* Bottom Row */}
        <div className="grid gap-6 md:grid-cols-3">
          <MembershipDistribution data={membershipData} />
          
          {/* Live Access Log - Real-time Attendance Feed */}
          <Card className="border-border/50 md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-success" />
                Live Access Feed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LiveAccessLog />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
