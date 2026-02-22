import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  UserCheck, 
  ShoppingCart, 
  FileText, 
  UserPlus,
  Clock,
  AlertTriangle,
  CheckCircle,
  Users,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Link } from 'react-router-dom';

export default function StaffDashboard() {
  const { profile, user } = useAuth();

  // Get today's date range
  const today = new Date();
  const todayStart = startOfDay(today).toISOString();
  const todayEnd = endOfDay(today).toISOString();

  // Fetch staff's assigned branch
  const { data: staffBranch } = useQuery({
    queryKey: ['staff-branch', user?.id],
    enabled: !!user,
    queryFn: async () => {
      // First check employees table
      const { data: employee } = await supabase
        .from('employees')
        .select('branch_id, branch:branches(id, name)')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .single();
      
      if (employee?.branch_id) return employee.branch;

      // Fallback to first branch
      const { data: branches } = await supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true)
        .limit(1);
      
      return branches?.[0] || null;
    },
  });

  const branchId = staffBranch?.id;

  // Fetch today's stats
  const { data: stats } = useQuery({
    queryKey: ['staff-dashboard-stats', branchId],
    enabled: !!branchId,
    queryFn: async () => {
      // Today's check-ins
      const { count: todayCheckins } = await supabase
        .from('member_attendance')
        .select('id', { count: 'exact' })
        .eq('branch_id', branchId!)
        .gte('check_in', todayStart)
        .lte('check_in', todayEnd);

      // Currently in gym
      const { count: currentlyIn } = await supabase
        .from('member_attendance')
        .select('id', { count: 'exact' })
        .eq('branch_id', branchId!)
        .gte('check_in', todayStart)
        .is('check_out', null);

      // Pending invoices
      const { count: pendingInvoices } = await supabase
        .from('invoices')
        .select('id', { count: 'exact' })
        .eq('branch_id', branchId!)
        .eq('status', 'pending');

      // Leads requiring follow-up
      const { count: pendingLeads } = await supabase
        .from('leads')
        .select('id', { count: 'exact' })
        .eq('branch_id', branchId!)
        .in('status', ['new', 'contacted']);

      // Expiring today
      const { count: expiringToday } = await supabase
        .from('memberships')
        .select('id', { count: 'exact' })
        .eq('branch_id', branchId!)
        .eq('status', 'active')
        .eq('end_date', today.toISOString().split('T')[0]);

      // Expiring this week
      const next7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { count: expiringWeek } = await supabase
        .from('memberships')
        .select('id', { count: 'exact' })
        .eq('branch_id', branchId!)
        .eq('status', 'active')
        .lte('end_date', next7Days)
        .gte('end_date', today.toISOString().split('T')[0]);

      return {
        todayCheckins: todayCheckins || 0,
        currentlyIn: currentlyIn || 0,
        pendingInvoices: pendingInvoices || 0,
        pendingLeads: pendingLeads || 0,
        expiringToday: expiringToday || 0,
        expiringWeek: expiringWeek || 0,
      };
    },
  });

  // Fetch pending tasks assigned to staff
  const { data: pendingTasks = [] } = useQuery({
    queryKey: ['staff-tasks', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user!.id)
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch leads requiring follow-up
  const { data: followUpLeads = [] } = useQuery({
    queryKey: ['staff-followup-leads', branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, phone, source, status, follow_up_date, notes')
        .eq('branch_id', branchId!)
        .in('status', ['new', 'contacted'])
        .order('follow_up_date', { ascending: true, nullsFirst: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch recent check-ins
  const { data: recentCheckins = [] } = useQuery({
    queryKey: ['recent-checkins', branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_attendance')
        .select(`
          id,
          check_in,
          member:members(member_code, user_id, profiles:user_id(full_name))
        `)
        .eq('branch_id', branchId!)
        .gte('check_in', todayStart)
        .order('check_in', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch expiring memberships
  const { data: expiringMemberships = [] } = useQuery({
    queryKey: ['expiring-memberships', branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const next3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('memberships')
        .select(`
          id,
          end_date,
          member:members(member_code, user_id, profiles:user_id(full_name, phone))
        `)
        .eq('branch_id', branchId!)
        .eq('status', 'active')
        .lte('end_date', next3Days)
        .gte('end_date', today.toISOString().split('T')[0])
        .order('end_date', { ascending: true })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Hello, {profile?.full_name?.split(' ')[0] || 'Staff'}!
            </h1>
            <p className="text-muted-foreground">
              {staffBranch?.name || 'Your Branch'} • {format(today, 'EEEE, dd MMM yyyy')}
            </p>
          </div>
          <Badge variant="default" className="w-fit">Staff</Badge>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Link to="/attendance">
            <Card className="hover:border-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
                <UserCheck className="h-8 w-8 text-success" />
                <span className="font-medium text-center">Check In Member</span>
              </CardContent>
            </Card>
          </Link>
          <Link to="/pos">
            <Card className="hover:border-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
                <ShoppingCart className="h-8 w-8 text-accent" />
                <span className="font-medium text-center">Open POS</span>
              </CardContent>
            </Card>
          </Link>
          <Link to="/leads">
            <Card className="hover:border-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
                <UserPlus className="h-8 w-8 text-warning" />
                <span className="font-medium text-center">Add Lead</span>
              </CardContent>
            </Card>
          </Link>
          <Link to="/invoices">
            <Card className="hover:border-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
                <FileText className="h-8 w-8 text-primary" />
                <span className="font-medium text-center">View Invoices</span>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard
            title="Today's Check-ins"
            value={stats?.todayCheckins || 0}
            icon={UserCheck}
            description={`${stats?.currentlyIn || 0} currently in`}
            variant="success"
          />
          <StatCard
            title="Pending Invoices"
            value={stats?.pendingInvoices || 0}
            icon={FileText}
            variant="warning"
          />
          <StatCard
            title="Active Leads"
            value={stats?.pendingLeads || 0}
            icon={UserPlus}
            variant="accent"
          />
          <StatCard
            title="Expiring This Week"
            value={stats?.expiringWeek || 0}
            icon={AlertTriangle}
            description={`${stats?.expiringToday || 0} today`}
            variant="destructive"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Check-ins */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Check-ins
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/attendance">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentCheckins.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No check-ins today</p>
              ) : (
                <div className="space-y-3">
                  {recentCheckins.map((checkin: any) => (
                    <div key={checkin.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-success" />
                        <div>
                          <p className="font-medium">
                            {checkin.member?.profiles?.full_name || checkin.member?.member_code}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {checkin.member?.member_code}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(checkin.check_in), 'HH:mm')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expiring Memberships */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Expiring Soon
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/members">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {expiringMemberships.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No memberships expiring soon</p>
              ) : (
                <div className="space-y-3">
                  {expiringMemberships.map((membership: any) => {
                    const daysLeft = Math.ceil(
                      (new Date(membership.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <div key={membership.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">
                            {membership.member?.profiles?.full_name || membership.member?.member_code}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {membership.member?.profiles?.phone || 'No phone'}
                          </p>
                        </div>
                        <Badge variant={daysLeft <= 1 ? 'destructive' : 'secondary'}>
                          {daysLeft <= 0 ? 'Today' : `${daysLeft} day${daysLeft > 1 ? 's' : ''}`}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leads Requiring Follow-Up */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-accent" />
                Follow-Up Leads
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/leads">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {followUpLeads.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No leads pending follow-up</p>
              ) : (
                <div className="space-y-3">
                  {followUpLeads.map((lead: any) => (
                    <div key={lead.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{lead.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {lead.phone || 'No phone'} • {lead.source || 'Unknown'}
                        </p>
                        {lead.follow_up_date && (
                          <p className="text-xs text-warning mt-0.5">
                            Follow-up: {format(new Date(lead.follow_up_date), 'dd MMM')}
                          </p>
                        )}
                      </div>
                      <Badge variant={lead.status === 'new' ? 'default' : 'secondary'}>
                        {lead.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Tasks */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                My Pending Tasks
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/tasks">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {pendingTasks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No pending tasks</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {pendingTasks.map((task: any) => (
                    <div key={task.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{task.title}</p>
                        {task.due_date && (
                          <p className="text-sm text-muted-foreground">
                            Due: {format(new Date(task.due_date), 'dd MMM yyyy')}
                          </p>
                        )}
                      </div>
                      <Badge variant={task.status === 'in_progress' ? 'default' : 'secondary'}>
                        {task.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
