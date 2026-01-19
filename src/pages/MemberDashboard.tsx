import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMemberData } from '@/hooks/useMemberData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Calendar, Clock, CreditCard, Dumbbell, FileText, 
  TrendingUp, User, AlertCircle, CheckCircle, Lock
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function MemberDashboard() {
  const { profile } = useAuth();
  const { 
    member, 
    activeMembership, 
    ptPackages, 
    recentAttendance, 
    pendingInvoices,
    upcomingClasses,
    daysRemaining,
    isLoading 
  } = useMemberData();

  // Fetch assigned locker - MUST be called before any early returns to follow Rules of Hooks
  const { data: assignedLocker } = useQuery({
    queryKey: ['my-locker', member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locker_assignments')
        .select('*, locker:lockers(locker_number, size)')
        .eq('member_id', member!.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching locker:', error);
        return null;
      }
      return data;
    },
  });

  if (isLoading) {
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
          <p className="text-muted-foreground">Your account is not linked to a member profile.</p>
        </div>
      </AppLayout>
    );
  }

  const activePtPackage = ptPackages.find(p => p.status === 'active');
  const totalPendingAmount = pendingInvoices.reduce((sum, inv) => sum + (inv.total_amount - (inv.amount_paid || 0)), 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome, {profile?.full_name?.split(' ')[0] || 'Member'}!
            </h1>
            <p className="text-muted-foreground">
              Member ID: {member.member_code} • {member.branch?.name}
            </p>
          </div>
          <Badge variant={activeMembership ? "default" : "destructive"} className="w-fit">
            {activeMembership ? 'Active Membership' : 'No Active Membership'}
          </Badge>
        </div>

        {/* Primary Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard
            title="Membership Status"
            value={activeMembership ? activeMembership.plan?.name || 'Active' : 'Inactive'}
            icon={CreditCard}
            description={activeMembership ? `${daysRemaining} days remaining` : 'Renew now'}
            variant={activeMembership ? "success" : "destructive"}
          />
          <StatCard
            title="PT Sessions"
            value={activePtPackage?.sessions_remaining || 0}
            icon={Dumbbell}
            description={activePtPackage ? `of ${activePtPackage.sessions_total} remaining` : 'No active package'}
            variant="accent"
          />
          <StatCard
            title="This Month Visits"
            value={recentAttendance.filter(a => 
              new Date(a.check_in).getMonth() === new Date().getMonth()
            ).length}
            icon={Clock}
            variant="default"
          />
          <StatCard
            title="Pending Dues"
            value={`₹${totalPendingAmount.toLocaleString()}`}
            icon={FileText}
            description={pendingInvoices.length > 0 ? `${pendingInvoices.length} invoice(s)` : 'All paid'}
            variant={totalPendingAmount > 0 ? "warning" : "success"}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-4">
          <Link to="/my-classes">
            <Card className="hover:border-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
                <Calendar className="h-8 w-8 text-accent" />
                <span className="font-medium">Book a Class</span>
              </CardContent>
            </Card>
          </Link>
          <Link to="/my-progress">
            <Card className="hover:border-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
                <TrendingUp className="h-8 w-8 text-success" />
                <span className="font-medium">View Progress</span>
              </CardContent>
            </Card>
          </Link>
          <Link to="/member-store">
            <Card className="hover:border-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
                <CreditCard className="h-8 w-8 text-warning" />
                <span className="font-medium">Shop Products</span>
              </CardContent>
            </Card>
          </Link>
          <Link to="/my-requests">
            <Card className="hover:border-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
                <User className="h-8 w-8 text-primary" />
                <span className="font-medium">My Requests</span>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Membership Details */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Membership Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeMembership ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="font-medium">{activeMembership.plan?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start Date</span>
                    <span>{format(new Date(activeMembership.start_date), 'dd MMM yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">End Date</span>
                    <span>{format(new Date(activeMembership.end_date), 'dd MMM yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Days Remaining</span>
                    <Badge variant={daysRemaining > 7 ? "default" : "destructive"}>
                      {daysRemaining} days
                    </Badge>
                  </div>
                  {daysRemaining <= 7 && (
                    <Button className="w-full" asChild>
                      <Link to="/my-requests">Request Renewal</Link>
                    </Button>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">No active membership</p>
                  <Button asChild>
                    <Link to="/my-requests">Request Membership</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Classes */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Classes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingClasses.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">No upcoming classes</p>
                  <Button variant="outline" asChild>
                    <Link to="/my-classes">Book a Class</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingClasses.slice(0, 3).map((booking: any) => (
                    <div key={booking.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{booking.class?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(booking.class?.scheduled_at), 'EEE, dd MMM • HH:mm')}
                        </p>
                      </div>
                      <Badge variant="outline">Booked</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Attendance */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentAttendance.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No attendance records</p>
              ) : (
                <div className="space-y-3">
                  {recentAttendance.slice(0, 5).map((record) => (
                    <div key={record.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span>{format(new Date(record.check_in), 'dd MMM yyyy')}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(record.check_in), 'HH:mm')}
                        {record.check_out && ` - ${format(new Date(record.check_out), 'HH:mm')}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assigned Trainer */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Dumbbell className="h-5 w-5" />
                My Trainer
              </CardTitle>
            </CardHeader>
            <CardContent>
              {member.assigned_trainer ? (
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium">{(member.assigned_trainer as any)?.profile?.full_name || 'Trainer'}</p>
                    <p className="text-sm text-muted-foreground">Personal Trainer</p>
                  </div>
                </div>
              ) : activePtPackage?.trainer ? (
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium">{(activePtPackage.trainer as any)?.profile?.full_name || 'Trainer'}</p>
                    <p className="text-sm text-muted-foreground">PT Package Trainer</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">No trainer assigned</p>
                  <Button variant="outline" asChild>
                    <Link to="/my-requests">Request Trainer</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assigned Locker */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="h-5 w-5" />
                My Locker
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assignedLocker ? (
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
                    <Lock className="h-6 w-6 text-warning" />
                  </div>
                  <div>
                    <p className="font-medium">Locker #{assignedLocker.locker?.locker_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {assignedLocker.locker?.size || 'Standard'} Size
                      {assignedLocker.end_date && ` • Until ${format(new Date(assignedLocker.end_date), 'dd MMM yyyy')}`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">No locker assigned</p>
                  <Button variant="outline" asChild>
                    <Link to="/my-requests">Request Locker</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
